CREATE OR REPLACE FUNCTION public.admin_td_report(_start date, _end date, _area text DEFAULT NULL, _track uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _company text; _result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS (SELECT 1 FROM profiles WHERE user_id=auth.uid() AND is_active IS TRUE) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT nullif(trim(empresa),'') INTO _company FROM profiles WHERE user_id=auth.uid();
 IF _company IS NULL OR _company='Não informada' THEN RAISE EXCEPTION 'Empresa administrada não definida' USING ERRCODE='42501'; END IF;
 IF _start IS NULL OR _end IS NULL OR _end < _start OR _end-_start > 1096 THEN RAISE EXCEPTION 'Período inválido (máximo de 3 anos)'; END IF;
 WITH months AS (SELECT generate_series(date_trunc('month',_start::timestamp),date_trunc('month',_end::timestamp),interval '1 month')::date AS period_month),
 cohort AS (
 SELECT e.user_id,e.track_id,date_trunc('month',e.enrolled_at AT TIME ZONE 'America/Sao_Paulo')::date AS period_month,
 bool_or(e.status='completed' AND e.completed_at IS NOT NULL AND (e.completed_at AT TIME ZONE 'America/Sao_Paulo')::date<=_end) AS completed
 FROM enrollments e JOIN profiles p ON p.user_id=e.user_id
 WHERE p.empresa=_company AND (e.enrolled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _start AND _end AND (_track IS NULL OR e.track_id=_track)
 GROUP BY e.user_id,e.track_id,3
 ),
 completion AS (SELECT m.period_month AS month,count(c.user_id) AS enrolled,count(c.user_id) FILTER(WHERE c.completed) AS completed FROM months m LEFT JOIN cohort c USING(period_month) GROUP BY m.period_month),
 answers AS (
 SELECT a.numeric_value,a.indicator,q.prompt,q.scale_min,q.scale_max,s.id AS survey_id,s.title,t.id AS track_id,t.title AS training
 FROM research_answers a JOIN research_questions q ON q.id=a.question_id JOIN research_responses r ON r.id=a.response_id JOIN research_invitations i ON i.id=r.invitation_id JOIN research_surveys s ON s.id=a.survey_id JOIN tracks t ON t.id=s.track_id
 WHERE s.audience='interno' AND i.company=_company AND (_track IS NULL OR t.id=_track) AND (_area IS NULL OR i.area=_area)
 AND i.training_date BETWEEN _start AND _end AND (r.submitted_at AT TIME ZONE 'America/Sao_Paulo')::date<=_end
 ),
 quality AS (
 SELECT survey_id,title,track_id,training,
 count(*) FILTER(WHERE indicator='nps' AND numeric_value BETWEEN 0 AND 10 AND scale_min=0 AND scale_max=10) AS nps_total,
 count(*) FILTER(WHERE indicator='nps' AND numeric_value BETWEEN 9 AND 10 AND scale_min=0 AND scale_max=10) AS promoters,
 count(*) FILTER(WHERE indicator='nps' AND numeric_value BETWEEN 0 AND 6 AND scale_min=0 AND scale_max=10) AS detractors,
 count(*) FILTER(WHERE numeric_value BETWEEN 1 AND 5 AND scale_min=1 AND scale_max=5 AND prompt ~* '(conteúdo|conteudo)') AS content_total,
 avg(numeric_value) FILTER(WHERE numeric_value BETWEEN 1 AND 5 AND scale_min=1 AND scale_max=5 AND prompt ~* '(conteúdo|conteudo)') AS content_mean
 FROM answers GROUP BY survey_id,title,track_id,training
 )
 SELECT jsonb_build_object(
 'company',_company,
 'tracks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title) ORDER BY title) FROM tracks),'[]'::jsonb),
 'areas',coalesce((SELECT jsonb_agg(area ORDER BY area) FROM (SELECT DISTINCT trim(e.area) AS area FROM research_employees e JOIN research_employee_bases b ON b.id=e.base_id WHERE b.audience='interno' AND b.company_name=_company AND nullif(trim(e.area),'') IS NOT NULL) x),'[]'::jsonb),
 'completion',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY month) FROM completion c),'[]'::jsonb),
 'quality',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY training,title) FROM quality q),'[]'::jsonb),
 'base_count',(SELECT count(*) FROM research_employee_bases WHERE audience='interno' AND company_name=_company),
 'presence_count',(SELECT count(*) FROM research_attendance WHERE audience='interno' AND company=_company AND training_date BETWEEN _start AND _end AND (_track IS NULL OR track_id=_track) AND (_area IS NULL OR area=_area))
 ) INTO _result;
 RETURN _result;
END $$;
REVOKE ALL ON FUNCTION public.admin_td_report(date,date,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_td_report(date,date,text,uuid) TO authenticated,service_role;