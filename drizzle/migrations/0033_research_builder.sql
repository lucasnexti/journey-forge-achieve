ALTER TABLE public.research_surveys ADD COLUMN presentation text NOT NULL DEFAULT '', ADD COLUMN training_date date, ADD COLUMN thank_you text NOT NULL DEFAULT 'Sua participação ajuda a melhorar nossos treinamentos.', ADD COLUMN anonymous boolean NOT NULL DEFAULT false, ADD COLUMN published_at timestamptz;
ALTER TABLE public.research_questions ADD COLUMN allow_comment boolean NOT NULL DEFAULT false, ADD COLUMN scale_display text NOT NULL DEFAULT 'numeric';
ALTER TABLE public.research_answers ADD COLUMN additional_comment text;
CREATE TABLE public.research_anonymous_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE, answers jsonb NOT NULL);
GRANT ALL ON public.research_anonymous_submissions TO service_role;
ALTER TABLE public.research_anonymous_submissions ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.research_anonymous_submissions IS 'Anonymous answers: deliberately no invitation, identity, demographic or timestamp fields; accessed only through protected aggregate RPC.';
CREATE FUNCTION public.research_builder_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_TABLE_NAME='research_surveys' THEN
  IF length(NEW.presentation)>2000 OR length(NEW.thank_you)>1000 OR btrim(NEW.thank_you)='' THEN RAISE EXCEPTION 'Apresentação ou agradecimento inválido'; END IF;
  IF TG_OP='UPDATE' AND (OLD.first_sent_at IS NOT NULL OR OLD.published_at IS NOT NULL) AND (NEW.anonymous IS DISTINCT FROM OLD.anonymous OR NEW.presentation IS DISTINCT FROM OLD.presentation OR NEW.thank_you IS DISTINCT FROM OLD.thank_you OR NEW.training_date IS DISTINCT FROM OLD.training_date) THEN RAISE EXCEPTION 'Crie nova versão para mudar a pesquisa publicada'; END IF;
  IF current_user IN ('authenticated','anon') AND ((TG_OP='INSERT' AND NEW.published_at IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.published_at IS DISTINCT FROM OLD.published_at)) THEN RAISE EXCEPTION 'Use Publicar pesquisa'; END IF;
 ELSE
  IF NEW.scale_display NOT IN ('numeric','stars','satisfaction') OR (NEW.scale_display<>'numeric' AND (NEW.type<>'scale' OR NEW.scale_min<>1 OR NEW.scale_max<>5)) THEN RAISE EXCEPTION 'Formato da escala inválido'; END IF;
  IF NEW.type IN ('single','multiple') AND (EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.options) o WHERE jsonb_typeof(o)<>'string' OR length(btrim(o #>> '{}')) NOT BETWEEN 1 AND 200) OR (SELECT count(DISTINCT btrim(o)) FROM jsonb_array_elements_text(NEW.options) o)<>jsonb_array_length(NEW.options)) THEN RAISE EXCEPTION 'Alternativas inválidas ou repetidas'; END IF;
  IF EXISTS(SELECT 1 FROM research_surveys WHERE id=NEW.survey_id AND published_at IS NOT NULL) THEN RAISE EXCEPTION 'Crie nova versão para mudar perguntas publicadas'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER research_builder_guard BEFORE INSERT OR UPDATE ON public.research_surveys FOR EACH ROW EXECUTE FUNCTION public.research_builder_guard();
CREATE TRIGGER research_builder_question_guard BEFORE INSERT OR UPDATE ON public.research_questions FOR EACH ROW EXECUTE FUNCTION public.research_builder_guard();
CREATE FUNCTION public.research_save_builder(_id uuid,_data jsonb,_questions jsonb,_publish boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _q jsonb; _new uuid; _pos int:=0;
BEGIN
 IF NOT research_can('surveys_edit') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_data)<>'object' OR jsonb_typeof(_questions)<>'array' OR jsonb_array_length(_questions)=0 THEN RAISE EXCEPTION 'Adicione perguntas'; END IF;
 IF _id IS NOT NULL THEN SELECT * INTO _s FROM research_surveys WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF; IF _s.first_sent_at IS NOT NULL OR _s.published_at IS NOT NULL THEN RAISE EXCEPTION 'Crie nova versão para editar pesquisa publicada'; END IF; END IF;
 _s:=jsonb_populate_record(NULL::research_surveys,_data);
 IF _s.track_id IS NULL AND nullif(btrim(_s.training_name),'') IS NULL AND nullif(btrim(_s.class_name),'') IS NULL AND nullif(btrim(_s.standalone_reason),'') IS NULL THEN RAISE EXCEPTION 'Informe treinamento ou motivo da pesquisa'; END IF;
 IF btrim(coalesce(_s.email_subject,''))='' OR btrim(coalesce(_s.email_body,''))='' THEN RAISE EXCEPTION 'Preencha assunto e mensagem'; END IF;
 IF _s.reminder_enabled AND _s.reminder_after_days>=_s.deadline_days THEN RAISE EXCEPTION 'Lembrete precisa ser anterior ao prazo'; END IF;
 IF _s.kind IN ('nps','csat') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_questions) q WHERE q->>'indicator'=_s.kind) THEN RAISE EXCEPTION 'Pergunta do indicador ausente'; END IF;
 IF _id IS NULL THEN INSERT INTO research_surveys(audience,kind,title,description,track_id,training_name,class_name,standalone_reason,email_subject,email_body,deadline_days,reminder_enabled,reminder_after_days,presentation,training_date,thank_you,anonymous)
 VALUES(_s.audience,_s.kind,btrim(_s.title),coalesce(_s.description,''),_s.track_id,_s.training_name,_s.class_name,_s.standalone_reason,_s.email_subject,_s.email_body,_s.deadline_days,_s.reminder_enabled,_s.reminder_after_days,coalesce(_s.presentation,''),_s.training_date,coalesce(_s.thank_you,'Obrigado pela participação!'),coalesce(_s.anonymous,false)) RETURNING id INTO _new;
 ELSE _new:=_id; UPDATE research_surveys SET audience=_s.audience,kind=_s.kind,title=btrim(_s.title),description=coalesce(_s.description,''),track_id=_s.track_id,training_name=_s.training_name,class_name=_s.class_name,standalone_reason=_s.standalone_reason,email_subject=_s.email_subject,email_body=_s.email_body,deadline_days=_s.deadline_days,reminder_enabled=_s.reminder_enabled,reminder_after_days=_s.reminder_after_days,presentation=coalesce(_s.presentation,''),training_date=_s.training_date,thank_you=_s.thank_you,anonymous=coalesce(_s.anonymous,false),updated_at=now() WHERE id=_new;
 DELETE FROM research_questions WHERE survey_id=_new; END IF;
 FOR _q IN SELECT * FROM jsonb_array_elements(_questions) LOOP
 INSERT INTO research_questions(survey_id,position,type,indicator,prompt,required,options,scale_min,scale_max,min_label,max_label,allow_comment,scale_display)
 VALUES(_new,_pos,_q->>'type',nullif(_q->>'indicator',''),btrim(_q->>'prompt'),coalesce((_q->>'required')::boolean,true),coalesce(_q->'options','[]'),(_q->>'scale_min')::int,(_q->>'scale_max')::int,_q->>'min_label',_q->>'max_label',coalesce((_q->>'allow_comment')::boolean,false),coalesce(_q->>'scale_display','numeric')); _pos:=_pos+1;
 END LOOP;
 IF _publish THEN UPDATE research_surveys SET published_at=now() WHERE id=_new; END IF;
 RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.research_save_builder(uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.research_save_builder(uuid,jsonb,jsonb,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.research_get_form(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _inv research_invitations%ROWTYPE; _s research_surveys%ROWTYPE;
BEGIN
 IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('state','invalid'); END IF;
 SELECT i.* INTO _inv FROM research_invitation_tokens t JOIN research_invitations i ON i.id=t.invitation_id WHERE t.token=_token; IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
 SELECT * INTO _s FROM research_surveys WHERE id=_inv.survey_id;
 IF _s.status='draft' THEN RETURN jsonb_build_object('state','invalid'); END IF;
 IF _inv.responded_at IS NOT NULL THEN RETURN jsonb_build_object('state','answered','title',_s.title); END IF;
 IF _s.status<>'active' OR _s.deadline_at<=now() THEN RETURN jsonb_build_object('state','closed','title',_s.title); END IF;
 RETURN jsonb_build_object('state','open','title',_s.title,'description',_s.description,'presentation',_s.presentation,'training_name',_s.training_name,'training_date',_s.training_date,'thank_you',_s.thank_you,'anonymous',_s.anonymous,'deadline_at',_s.deadline_at,'questions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'type',type,'indicator',indicator,'prompt',prompt,'required',required,'options',options,'scale_min',scale_min,'scale_max',scale_max,'min_label',min_label,'max_label',max_label,'allow_comment',allow_comment,'scale_display',scale_display) ORDER BY position) FROM research_questions WHERE survey_id=_s.id),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.research_submit_response(_token text,_answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _inv research_invitations%ROWTYPE; _s research_surveys%ROWTYPE; _q record; _v jsonb; _raw jsonb; _rows jsonb:='[]'; _resp uuid; _num numeric; _txt text; _comment text; _empty boolean;
BEGIN
 IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('state','invalid'); END IF;
 IF _answers IS NULL OR jsonb_typeof(_answers)<>'object' OR octet_length(_answers::text)>1048576 THEN RETURN jsonb_build_object('state','error','message','Respostas inválidas'); END IF;
 SELECT i.* INTO _inv FROM research_invitation_tokens t JOIN research_invitations i ON i.id=t.invitation_id WHERE t.token=_token FOR UPDATE OF i;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
 SELECT * INTO _s FROM research_surveys WHERE id=_inv.survey_id;
 IF _s.status='draft' THEN RETURN jsonb_build_object('state','invalid'); END IF;
 IF _inv.responded_at IS NOT NULL THEN RETURN jsonb_build_object('state','answered'); END IF;
 IF _s.status<>'active' OR _s.deadline_at<=now() THEN RETURN jsonb_build_object('state','closed'); END IF;
 FOR _q IN SELECT * FROM research_questions WHERE survey_id=_s.id ORDER BY position LOOP
  _raw:=_answers->(_q.id::text); _v:=CASE WHEN jsonb_typeof(_raw)='object' THEN _raw->'value' ELSE _raw END; _comment:=NULL;
  IF jsonb_typeof(_raw)='object' AND _raw ? 'comment' THEN
   IF NOT _q.allow_comment OR jsonb_typeof(_raw->'comment')<>'string' OR length(_raw->>'comment')>2000 THEN RETURN jsonb_build_object('state','error','message','Comentário inválido','question_id',_q.id); END IF;
   _comment:=nullif(btrim(_raw->>'comment'),'');
  END IF;
  _empty:=_v IS NULL OR _v='null'::jsonb OR (jsonb_typeof(_v)='string' AND btrim(_v #>> '{}')='') OR (jsonb_typeof(_v)='array' AND jsonb_array_length(_v)=0);
  IF _empty THEN IF _q.required THEN RETURN jsonb_build_object('state','error','message','Resposta obrigatória','question_id',_q.id); END IF;
   IF _comment IS NOT NULL THEN _rows:=_rows||jsonb_build_array(jsonb_build_object('q',_q.id,'comment',_comment)); END IF; CONTINUE; END IF;
  IF _q.type='scale' THEN
   IF jsonb_typeof(_v)<>'number' THEN RETURN jsonb_build_object('state','error','message','Nota inválida','question_id',_q.id); END IF;
   _num:=(_v #>> '{}')::numeric; IF _num<>trunc(_num) OR _num<_q.scale_min OR _num>_q.scale_max THEN RETURN jsonb_build_object('state','error','message','Nota fora da escala','question_id',_q.id); END IF;
   _rows:=_rows||jsonb_build_array(jsonb_build_object('q',_q.id,'ind',_q.indicator,'n',_num::int,'comment',_comment));
  ELSIF _q.type='single' THEN
   IF jsonb_typeof(_v)<>'string' OR NOT (_q.options ? (_v #>> '{}')) THEN RETURN jsonb_build_object('state','error','message','Alternativa inválida','question_id',_q.id); END IF;
   _rows:=_rows||jsonb_build_array(jsonb_build_object('q',_q.id,'c',jsonb_build_array(_v #>> '{}'),'comment',_comment));
  ELSIF _q.type='multiple' THEN
   IF jsonb_typeof(_v)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(_v) e WHERE jsonb_typeof(e)<>'string' OR NOT (_q.options ? (e #>> '{}'))) THEN RETURN jsonb_build_object('state','error','message','Alternativa inválida','question_id',_q.id); END IF;
   _rows:=_rows||jsonb_build_array(jsonb_build_object('q',_q.id,'c',(SELECT jsonb_agg(DISTINCT e) FROM jsonb_array_elements_text(_v) e),'comment',_comment));
  ELSE
   IF jsonb_typeof(_v)<>'string' OR length(_v #>> '{}')>2000 THEN RETURN jsonb_build_object('state','error','message','Texto inválido','question_id',_q.id); END IF;
   _rows:=_rows||jsonb_build_array(jsonb_build_object('q',_q.id,'t',btrim(_v #>> '{}'),'comment',_comment));
  END IF;
 END LOOP;
 IF jsonb_array_length(_rows)=0 THEN RETURN jsonb_build_object('state','error','message','Responda ao menos uma pergunta'); END IF;
 IF _s.anonymous THEN INSERT INTO research_anonymous_submissions(survey_id,answers) VALUES(_s.id,_rows);
 ELSE
  INSERT INTO research_responses(invitation_id,survey_id) VALUES(_inv.id,_s.id) RETURNING id INTO _resp;
  INSERT INTO research_answers(response_id,survey_id,question_id,indicator,numeric_value,choice_values,text_value,additional_comment)
  SELECT _resp,_s.id,(r->>'q')::uuid,r->>'ind',(r->>'n')::int,CASE WHEN r ? 'c' THEN ARRAY(SELECT jsonb_array_elements_text(r->'c')) END,r->>'t',r->>'comment' FROM jsonb_array_elements(_rows) r;
 END IF;
 UPDATE research_invitations SET responded_at=now() WHERE id=_inv.id;
 UPDATE research_email_jobs SET status='skipped',last_error='Já respondeu',updated_at=now() WHERE invitation_id=_inv.id AND kind<>'invite' AND status IN ('queued','blocked_config');
 RETURN jsonb_build_object('state','submitted','thank_you',_s.thank_you);
END $$;
CREATE FUNCTION public.research_builder_results(_survey uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _identified boolean; _result jsonb;
BEGIN
 IF NOT research_can('indicators_view') THEN RAISE EXCEPTION 'Sem permissão para resultados' USING ERRCODE='42501'; END IF;
 SELECT * INTO _s FROM research_surveys WHERE id=_survey; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 _identified:=NOT _s.anonymous AND research_can('responses_identified');
 WITH answers AS (
 SELECT a.question_id,a.numeric_value AS n,to_jsonb(a.choice_values) AS c,a.text_value AS t,a.additional_comment AS comment,CASE WHEN _identified THEN i.name END AS name,CASE WHEN _identified THEN i.email END AS email FROM research_answers a JOIN research_responses r ON r.id=a.response_id JOIN research_invitations i ON i.id=r.invitation_id WHERE a.survey_id=_survey AND NOT _s.anonymous
 UNION ALL SELECT (x->>'q')::uuid,(x->>'n')::int,x->'c',x->>'t',x->>'comment',NULL,NULL FROM research_anonymous_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.answers) x WHERE s.survey_id=_survey AND _s.anonymous
 )
 SELECT jsonb_build_object('title',_s.title,'anonymous',_s.anonymous,'identified',_identified,'invited',(SELECT count(*) FROM research_invitations WHERE survey_id=_survey),'respondents',CASE WHEN _s.anonymous THEN (SELECT count(*) FROM research_anonymous_submissions WHERE survey_id=_survey) ELSE (SELECT count(*) FROM research_responses WHERE survey_id=_survey) END,
 'questions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'type',q.type,'indicator',q.indicator,'min',q.scale_min,'max',q.scale_max,
 'n',(SELECT count(*) FROM answers a WHERE a.question_id=q.id AND (a.n IS NOT NULL OR a.c IS NOT NULL OR a.t IS NOT NULL)),
 'avg',(SELECT avg(a.n) FROM answers a WHERE a.question_id=q.id),
 'distribution',CASE WHEN q.type='scale' THEN (SELECT jsonb_agg(jsonb_build_object('label',g::text,'count',(SELECT count(*) FROM answers a WHERE a.question_id=q.id AND a.n=g))) FROM generate_series(q.scale_min,q.scale_max) g) WHEN q.type IN ('single','multiple') THEN (SELECT jsonb_agg(jsonb_build_object('label',o,'count',(SELECT count(*) FROM answers a WHERE a.question_id=q.id AND a.c ? o))) FROM jsonb_array_elements_text(q.options) o) ELSE '[]'::jsonb END,
 'comments',coalesce((SELECT jsonb_agg(jsonb_build_object('text',a.t,'additional',a.comment,'name',a.name,'email',a.email) ORDER BY coalesce(a.t,a.comment)) FROM answers a WHERE a.question_id=q.id AND (nullif(a.t,'') IS NOT NULL OR nullif(a.comment,'') IS NOT NULL)),'[]'::jsonb)) ORDER BY q.position) FROM research_questions q WHERE q.survey_id=_survey),'[]'::jsonb)) INTO _result;
 RETURN _result;
END $$;
REVOKE ALL ON FUNCTION public.research_builder_results(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.research_builder_results(uuid) TO authenticated,service_role;