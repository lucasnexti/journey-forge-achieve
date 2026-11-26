CREATE OR REPLACE FUNCTION public.research_filtered_invitations(_f jsonb) RETURNS SETOF public.research_invitations LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.* FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id WHERE NOT s.anonymous AND s.audience=_f->>'audience'
 AND (nullif(_f->>'survey_id','') IS NULL OR s.id=(_f->>'survey_id')::uuid)
 AND (nullif(_f->>'track_id','') IS NULL OR s.track_id=(_f->>'track_id')::uuid)
 AND (nullif(_f->>'training','') IS NULL OR lower(coalesce(i.training_name,s.training_name))=lower(_f->>'training'))
 AND (nullif(_f->>'class_name','') IS NULL OR lower(s.class_name)=lower(_f->>'class_name'))
 AND (nullif(_f->>'company','') IS NULL OR lower(i.company)=lower(_f->>'company'))
 AND (nullif(_f->>'area','') IS NULL OR lower(i.area)=lower(_f->>'area'))
 AND (coalesce(_f->>'responded','all')='all' OR (_f->>'responded'='yes' AND i.responded_at IS NOT NULL) OR (_f->>'responded'='no' AND i.responded_at IS NULL))
 AND (nullif(_f->>'send_status','') IS NULL OR i.send_status=_f->>'send_status')
 AND ((nullif(_f->>'from','') IS NULL AND nullif(_f->>'to','') IS NULL) OR (CASE coalesce(_f->>'date_basis','sent') WHEN 'training' THEN i.training_date WHEN 'response' THEN (i.responded_at AT TIME ZONE 'America/Sao_Paulo')::date ELSE (coalesce(i.sent_at,i.created_at) AT TIME ZONE 'America/Sao_Paulo')::date END) BETWEEN coalesce(nullif(_f->>'from','')::date,DATE '1900-01-01') AND coalesce(nullif(_f->>'to','')::date,DATE '2999-12-31'));
$$;