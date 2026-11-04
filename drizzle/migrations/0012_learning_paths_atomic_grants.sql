CREATE FUNCTION public.set_learning_path_access(_path uuid,_users uuid[] DEFAULT '{}'::uuid[],_company uuid DEFAULT NULL,_revoke boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
 PERFORM 1 FROM learning_paths WHERE id=_path FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trilha não encontrada'; END IF;
 IF _company IS NOT NULL THEN
  IF _revoke THEN UPDATE learning_path_grants SET revoked_at=now() WHERE path_id=_path AND company_id=_company; ELSE
  INSERT INTO learning_path_grants(path_id,company_id,granted_by) VALUES(_path,_company,auth.uid()) ON CONFLICT(path_id,company_id) WHERE company_id IS NOT NULL DO UPDATE SET revoked_at=NULL,granted_at=now(),granted_by=auth.uid(); END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM unnest(_users) u WHERE NOT EXISTS(SELECT 1 FROM profiles WHERE user_id=u)) THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _revoke THEN UPDATE learning_path_grants SET revoked_at=now() WHERE path_id=_path AND user_id=ANY(_users); ELSE
  INSERT INTO learning_path_grants(path_id,user_id,granted_by) SELECT _path,u,auth.uid() FROM unnest(_users) u ON CONFLICT(path_id,user_id) WHERE user_id IS NOT NULL DO UPDATE SET revoked_at=NULL,granted_at=now(),granted_by=auth.uid(); END IF;
 END IF;
 INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(auth.uid(),CASE WHEN _revoke THEN 'learning_path.revoke' ELSE 'learning_path.grant' END,'learning_paths',_path::text,jsonb_build_object('users',_users,'company',_company));
END; $$;
REVOKE ALL ON FUNCTION public.set_learning_path_access(uuid,uuid[],uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.set_learning_path_access(uuid,uuid[],uuid,boolean) TO authenticated,service_role;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='save_learning_path'; def:=replace(def,'IF _id IS NOT NULL AND NOT EXISTS','PERFORM pg_advisory_xact_lock(hashtextextended(pid::text,0)); IF _id IS NOT NULL AND NOT EXISTS'); EXECUTE def; END $$;
CREATE FUNCTION public.learning_quiz_access(_quiz uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM quizzes WHERE id=_quiz AND learning_course_access(track_id,auth.uid())); $$;
REVOKE ALL ON FUNCTION public.learning_quiz_access(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.learning_quiz_access(uuid) TO authenticated,service_role;
CREATE POLICY learning_quiz_questions_gate ON public.quiz_questions AS RESTRICTIVE FOR SELECT TO authenticated USING(public.learning_quiz_access(quiz_id));
CREATE POLICY learning_quiz_attempts_insert_gate ON public.quiz_attempts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.learning_quiz_access(quiz_id));