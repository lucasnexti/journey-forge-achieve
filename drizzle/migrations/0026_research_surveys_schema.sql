-- ===== Pesquisas e Indicadores: permissões =====
CREATE TABLE public.research_permissions(
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('surveys_edit','lists_import','surveys_send','responses_identified','indicators_view','settings_manage')),
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, permission));
GRANT SELECT ON public.research_permissions TO authenticated; GRANT ALL ON public.research_permissions TO service_role;
ALTER TABLE public.research_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_permissions_read ON public.research_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.research_can(_perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM research_permissions WHERE user_id=auth.uid() AND permission=_perm)
    ) AND EXISTS(SELECT 1 FROM profiles WHERE user_id=auth.uid() AND coalesce(is_active,true));
$$;
CREATE FUNCTION public.research_has_any() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM research_permissions WHERE user_id=auth.uid())
    ) AND EXISTS(SELECT 1 FROM profiles WHERE user_id=auth.uid() AND coalesce(is_active,true));
$$;
CREATE FUNCTION public.research_my_permissions() RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN NOT public.research_has_any() THEN ARRAY[]::text[]
    WHEN public.has_role(auth.uid(),'admin') THEN ARRAY['surveys_edit','lists_import','surveys_send','responses_identified','indicators_view','settings_manage','admin']
    ELSE coalesce((SELECT array_agg(permission ORDER BY permission) FROM research_permissions WHERE user_id=auth.uid()), ARRAY[]::text[]) END;
$$;
REVOKE ALL ON FUNCTION public.research_can(text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.research_can(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.research_has_any() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.research_has_any() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.research_my_permissions() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.research_my_permissions() TO authenticated, service_role;

CREATE FUNCTION public.research_set_user_permissions(_user_id uuid, _permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores podem conceder acessos' USING ERRCODE='42501'; END IF;
  IF _user_id IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(_permissions,'{}')) p WHERE p NOT IN ('surveys_edit','lists_import','surveys_send','responses_identified','indicators_view','settings_manage')) THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('research_perm:'||_user_id::text));
  DELETE FROM research_permissions WHERE user_id=_user_id AND permission <> ALL(coalesce(_permissions,'{}'));
  INSERT INTO research_permissions(user_id, permission, granted_by) SELECT _user_id, p, auth.uid() FROM unnest(coalesce(_permissions,'{}')) p ON CONFLICT DO NOTHING;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details) VALUES (auth.uid(),'research_set_permissions','research_permissions',_user_id::text, jsonb_build_object('permissions',_permissions));
END $$;
REVOKE ALL ON FUNCTION public.research_set_user_permissions(uuid,text[]) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.research_set_user_permissions(uuid,text[]) TO authenticated, service_role;

-- ===== Configurações por público =====
CREATE TABLE public.research_settings(
  audience text PRIMARY KEY CHECK (audience IN ('interno','clientes')),
  sender_email text NOT NULL CHECK (sender_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  sender_name text NOT NULL CHECK (btrim(sender_name) <> ''),
  default_deadline_days integer NOT NULL DEFAULT 7 CHECK (default_deadline_days BETWEEN 1 AND 90),
  default_reminder_days integer NOT NULL DEFAULT 3 CHECK (default_reminder_days BETWEEN 1 AND 60),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE ON public.research_settings TO authenticated; GRANT ALL ON public.research_settings TO service_role;
ALTER TABLE public.research_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_settings_read ON public.research_settings FOR SELECT TO authenticated USING (public.research_has_any());
CREATE POLICY research_settings_update ON public.research_settings FOR UPDATE TO authenticated USING (public.research_can('settings_manage')) WITH CHECK (public.research_can('settings_manage'));

-- ===== Pesquisas e perguntas =====
CREATE TABLE public.research_surveys(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('interno','clientes')),
  kind text NOT NULL CHECK (kind IN ('nps','csat','custom')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  training_name text CHECK (length(training_name) <= 200),
  class_name text CHECK (length(class_name) <= 200),
  standalone_reason text CHECK (length(standalone_reason) <= 1000),
  email_subject text NOT NULL DEFAULT '' CHECK (length(email_subject) <= 200),
  email_body text NOT NULL DEFAULT '' CHECK (length(email_body) <= 5000),
  deadline_days integer NOT NULL DEFAULT 7 CHECK (deadline_days BETWEEN 1 AND 90),
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_after_days integer NOT NULL DEFAULT 3 CHECK (reminder_after_days BETWEEN 1 AND 60),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  version integer NOT NULL DEFAULT 1,
  source_survey_id uuid REFERENCES public.research_surveys(id) ON DELETE SET NULL,
  first_sent_at timestamptz, deadline_at timestamptz, closed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX research_surveys_audience_idx ON public.research_surveys(audience, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_surveys TO authenticated; GRANT ALL ON public.research_surveys TO service_role;
ALTER TABLE public.research_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_surveys_read ON public.research_surveys FOR SELECT TO authenticated USING (public.research_has_any());
CREATE POLICY research_surveys_insert ON public.research_surveys FOR INSERT TO authenticated WITH CHECK (public.research_can('surveys_edit'));
CREATE POLICY research_surveys_update ON public.research_surveys FOR UPDATE TO authenticated USING (public.research_can('surveys_edit')) WITH CHECK (public.research_can('surveys_edit'));
CREATE POLICY research_surveys_delete ON public.research_surveys FOR DELETE TO authenticated USING (public.research_can('surveys_edit') AND first_sent_at IS NULL);

CREATE FUNCTION public.research_surveys_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft'; NEW.first_sent_at := NULL; NEW.deadline_at := NULL; NEW.closed_at := NULL;
    NEW.created_by := auth.uid(); NEW.version := 1; NEW.source_survey_id := NULL;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.first_sent_at IS DISTINCT FROM OLD.first_sent_at OR NEW.deadline_at IS DISTINCT FROM OLD.deadline_at
       OR NEW.closed_at IS DISTINCT FROM OLD.closed_at OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.source_survey_id IS DISTINCT FROM OLD.source_survey_id THEN
      RAISE EXCEPTION 'Use as ações da pesquisa (enviar, encerrar ou prorrogar) para alterar status e prazo';
    END IF;
    IF OLD.first_sent_at IS NOT NULL AND (NEW.audience IS DISTINCT FROM OLD.audience OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.deadline_days IS DISTINCT FROM OLD.deadline_days) THEN
      RAISE EXCEPTION 'Esta pesquisa já foi enviada. Para mudar a estrutura, crie uma nova versão ou cópia';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF OLD.first_sent_at IS NOT NULL THEN RAISE EXCEPTION 'Pesquisas já enviadas não podem ser excluídas'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER research_surveys_guard BEFORE INSERT OR UPDATE OR DELETE ON public.research_surveys FOR EACH ROW EXECUTE FUNCTION public.research_surveys_guard();

CREATE TABLE public.research_questions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('scale','single','multiple','text')),
  indicator text CHECK (indicator IN ('nps','csat')),
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 500),
  required boolean NOT NULL DEFAULT true,
  options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  scale_min integer, scale_max integer,
  min_label text CHECK (length(min_label) <= 60), max_label text CHECK (length(max_label) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (indicator IS NULL OR type = 'scale'),
  CHECK (indicator IS DISTINCT FROM 'nps' OR (scale_min = 0 AND scale_max = 10)),
  CHECK (indicator IS DISTINCT FROM 'csat' OR (scale_min = 1 AND scale_max = 5)),
  CHECK (type <> 'scale' OR (scale_min IS NOT NULL AND scale_max IS NOT NULL AND scale_min >= 0 AND scale_max > scale_min AND scale_max - scale_min <= 10)),
  CHECK (type NOT IN ('single','multiple') OR jsonb_array_length(options) BETWEEN 2 AND 20));
CREATE INDEX research_questions_survey_idx ON public.research_questions(survey_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_questions TO authenticated; GRANT ALL ON public.research_questions TO service_role;
ALTER TABLE public.research_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_questions_read ON public.research_questions FOR SELECT TO authenticated USING (public.research_has_any());
CREATE POLICY research_questions_write ON public.research_questions FOR ALL TO authenticated USING (public.research_can('surveys_edit')) WITH CHECK (public.research_can('surveys_edit'));

CREATE FUNCTION public.research_questions_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE _sent timestamptz;
BEGIN
  SELECT first_sent_at INTO _sent FROM research_surveys WHERE id = coalesce(NEW.survey_id, OLD.survey_id);
  IF _sent IS NOT NULL THEN RAISE EXCEPTION 'As perguntas desta pesquisa estão preservadas após o envio. Crie uma nova versão ou cópia'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.survey_id IS DISTINCT FROM OLD.survey_id THEN RAISE EXCEPTION 'Não é possível mover perguntas entre pesquisas'; END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER research_questions_lock BEFORE INSERT OR UPDATE OR DELETE ON public.research_questions FOR EACH ROW EXECUTE FUNCTION public.research_questions_lock();

-- ===== Listas de presença / destinatários =====
CREATE TABLE public.research_lists(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('interno','clientes')),
  purpose text NOT NULL CHECK (purpose IN ('attendance','recipients')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  company_name text, training_name text, training_date date, class_name text,
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  source_file_name text, source_sheet text,
  member_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.research_list_members(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.research_lists(id) ON DELETE CASCADE,
  name text NOT NULL, email text NOT NULL, area text, company text,
  training_name text, training_date date, class_name text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX research_list_members_uniq ON public.research_list_members(list_id, email, lower(coalesce(training_name,'')), coalesce(training_date, DATE '1900-01-01'));
CREATE TABLE public.research_attendance(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('interno','clientes')),
  email text NOT NULL, name text NOT NULL, area text, company text,
  training_name text NOT NULL, training_date date NOT NULL, class_name text,
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  list_id uuid NOT NULL REFERENCES public.research_lists(id),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX research_attendance_session_uniq ON public.research_attendance(audience, email, lower(btrim(training_name)), training_date);
CREATE INDEX research_attendance_date_idx ON public.research_attendance(audience, training_date);
GRANT SELECT ON public.research_lists, public.research_list_members, public.research_attendance TO authenticated;
GRANT ALL ON public.research_lists, public.research_list_members, public.research_attendance TO service_role;
ALTER TABLE public.research_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_lists_read ON public.research_lists FOR SELECT TO authenticated USING (public.research_can('lists_import') OR public.research_can('surveys_send'));
CREATE POLICY research_list_members_read ON public.research_list_members FOR SELECT TO authenticated USING (public.research_can('lists_import') OR public.research_can('surveys_send'));
CREATE POLICY research_attendance_read ON public.research_attendance FOR SELECT TO authenticated USING (public.research_can('lists_import'));

-- ===== Envios, convites, fila =====
CREATE TABLE public.research_dispatches(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  list_id uuid REFERENCES public.research_lists(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('invite','reminder','extension_notice')),
  recipients integer NOT NULL DEFAULT 0, skipped_existing integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.research_invitations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  list_id uuid REFERENCES public.research_lists(id) ON DELETE SET NULL,
  dispatch_id uuid REFERENCES public.research_dispatches(id) ON DELETE SET NULL,
  email text NOT NULL, name text NOT NULL, area text, company text, training_name text, training_date date,
  send_status text NOT NULL DEFAULT 'queued' CHECK (send_status IN ('queued','sending','sent','delivered','failed','blocked_config')),
  provider_message_id text, send_attempts integer NOT NULL DEFAULT 0, last_error text,
  sent_at timestamptz, delivered_at timestamptz, responded_at timestamptz,
  last_reminder_at timestamptz, reminder_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, email));
CREATE INDEX research_invitations_status_idx ON public.research_invitations(survey_id, send_status, responded_at);
CREATE TABLE public.research_invitation_tokens(
  invitation_id uuid PRIMARY KEY REFERENCES public.research_invitations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.research_email_jobs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.research_invitations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  dispatch_id uuid REFERENCES public.research_dispatches(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('invite','reminder','extension_notice')),
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','delivered','failed','blocked_config','skipped')),
  attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text, provider_message_id text, sender_email text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE(invitation_id, kind, dedupe_key));
CREATE INDEX research_email_jobs_queue_idx ON public.research_email_jobs(status, next_attempt_at);
CREATE TABLE public.research_deadline_changes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  previous_deadline timestamptz, new_deadline timestamptz NOT NULL, reason text,
  changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.research_dispatches, public.research_invitations, public.research_email_jobs, public.research_deadline_changes TO authenticated;
GRANT ALL ON public.research_dispatches, public.research_invitations, public.research_invitation_tokens, public.research_email_jobs, public.research_deadline_changes TO service_role;
ALTER TABLE public.research_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_deadline_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_dispatches_read ON public.research_dispatches FOR SELECT TO authenticated USING (public.research_can('surveys_send') OR public.research_can('responses_identified'));
CREATE POLICY research_invitations_read ON public.research_invitations FOR SELECT TO authenticated USING (public.research_can('surveys_send') OR public.research_can('responses_identified'));
CREATE POLICY research_email_jobs_read ON public.research_email_jobs FOR SELECT TO authenticated USING (public.research_can('surveys_send'));
CREATE POLICY research_deadline_changes_read ON public.research_deadline_changes FOR SELECT TO authenticated USING (public.research_has_any());

-- ===== Respostas =====
CREATE TABLE public.research_responses(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.research_invitations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.research_answers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.research_responses(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.research_surveys(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.research_questions(id),
  indicator text CHECK (indicator IN ('nps','csat')),
  numeric_value integer, choice_values text[], text_value text CHECK (length(text_value) <= 2000),
  UNIQUE(response_id, question_id));
CREATE INDEX research_answers_indicator_idx ON public.research_answers(survey_id, indicator);
GRANT SELECT ON public.research_responses, public.research_answers TO authenticated;
GRANT ALL ON public.research_responses, public.research_answers TO service_role;
ALTER TABLE public.research_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_responses_read ON public.research_responses FOR SELECT TO authenticated USING (public.research_can('responses_identified'));
CREATE POLICY research_answers_read ON public.research_answers FOR SELECT TO authenticated USING (public.research_can('responses_identified'));

-- ===== Base de colaboradores (versionada) =====
CREATE TABLE public.research_employee_bases(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('interno','clientes')),
  company_name text NOT NULL CHECK (btrim(company_name) <> ''),
  reference_date date NOT NULL,
  version integer NOT NULL,
  previous_base_id uuid REFERENCES public.research_employee_bases(id),
  absent_policy text NOT NULL DEFAULT 'keep' CHECK (absent_policy IN ('keep','inactivate','remove')),
  source_file_name text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX research_employee_bases_version_uniq ON public.research_employee_bases(audience, lower(btrim(company_name)), version);
CREATE TABLE public.research_employees(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.research_employee_bases(id) ON DELETE CASCADE,
  external_id text, name text NOT NULL, email text, area text, company text,
  active boolean NOT NULL DEFAULT true,
  origin text NOT NULL DEFAULT 'imported' CHECK (origin IN ('imported','carried')),
  CHECK (email IS NOT NULL OR external_id IS NOT NULL));
CREATE UNIQUE INDEX research_employees_email_uniq ON public.research_employees(base_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX research_employees_ext_uniq ON public.research_employees(base_id, external_id) WHERE external_id IS NOT NULL;
GRANT SELECT ON public.research_employee_bases, public.research_employees TO authenticated;
GRANT ALL ON public.research_employee_bases, public.research_employees TO service_role;
ALTER TABLE public.research_employee_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_employee_bases_read ON public.research_employee_bases FOR SELECT TO authenticated USING (public.research_can('lists_import') OR public.research_can('indicators_view'));
CREATE POLICY research_employees_read ON public.research_employees FOR SELECT TO authenticated USING (public.research_can('lists_import'));