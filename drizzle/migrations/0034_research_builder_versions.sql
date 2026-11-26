CREATE OR REPLACE FUNCTION public.research_questions_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM research_surveys WHERE id=coalesce(NEW.survey_id,OLD.survey_id) AND (first_sent_at IS NOT NULL OR published_at IS NOT NULL)) THEN RAISE EXCEPTION 'Perguntas preservadas: crie uma nova versão'; END IF;
 IF TG_OP='UPDATE' AND NEW.survey_id IS DISTINCT FROM OLD.survey_id THEN RAISE EXCEPTION 'Não é possível mover perguntas'; END IF;
 RETURN coalesce(NEW,OLD); END $$;
CREATE OR REPLACE FUNCTION public.research_duplicate_survey(_id uuid,_new_version boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _new uuid; _ver int;
BEGIN
 IF NOT research_can('surveys_edit') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 SELECT * INTO _s FROM research_surveys WHERE id=_id; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 IF _new_version THEN _ver:=coalesce((SELECT max(version) FROM research_surveys WHERE id=_id OR source_survey_id=_id OR (_s.source_survey_id IS NOT NULL AND (id=_s.source_survey_id OR source_survey_id=_s.source_survey_id))),_s.version)+1; ELSE _ver:=1; END IF;
 INSERT INTO research_surveys(audience,kind,title,description,track_id,training_name,class_name,standalone_reason,email_subject,email_body,deadline_days,reminder_enabled,reminder_after_days,version,source_survey_id,created_by,presentation,training_date,thank_you,anonymous)
 VALUES(_s.audience,_s.kind,CASE WHEN _new_version THEN left(regexp_replace(_s.title,' \(v\d+\)$','')||' (v'||_ver||')',200) ELSE left('Cópia de '||_s.title,200) END,_s.description,_s.track_id,_s.training_name,_s.class_name,_s.standalone_reason,_s.email_subject,_s.email_body,_s.deadline_days,_s.reminder_enabled,_s.reminder_after_days,_ver,_id,auth.uid(),_s.presentation,_s.training_date,_s.thank_you,_s.anonymous) RETURNING id INTO _new;
 INSERT INTO research_questions(survey_id,position,type,indicator,prompt,required,options,scale_min,scale_max,min_label,max_label,allow_comment,scale_display)
 SELECT _new,position,type,indicator,prompt,required,options,scale_min,scale_max,min_label,max_label,allow_comment,scale_display FROM research_questions WHERE survey_id=_id;
 RETURN _new; END $$;
CREATE FUNCTION public.research_identified_response_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM research_surveys WHERE id=NEW.survey_id AND anonymous) THEN RAISE EXCEPTION 'Respostas anônimas exigem armazenamento separado'; END IF; RETURN NEW; END $$;
CREATE TRIGGER research_identified_response_guard BEFORE INSERT OR UPDATE ON public.research_responses FOR EACH ROW EXECUTE FUNCTION public.research_identified_response_guard();