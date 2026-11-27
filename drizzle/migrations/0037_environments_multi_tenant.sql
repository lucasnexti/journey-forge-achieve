
-- 1. Ambientes
ALTER TABLE public.learning_companies ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.learning_companies ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
INSERT INTO public.learning_companies(name, slug) VALUES ('Nexti','nexti')
  ON CONFLICT (name) DO UPDATE SET slug = 'nexti';

ALTER TABLE public.learning_company_memberships ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE public.learning_company_memberships DROP CONSTRAINT IF EXISTS learning_company_memberships_role_check;
ALTER TABLE public.learning_company_memberships ADD CONSTRAINT learning_company_memberships_role_check CHECK (role IN ('admin','member'));
CREATE UNIQUE INDEX IF NOT EXISTS learning_company_memberships_one_active ON public.learning_company_memberships(user_id) WHERE revoked_at IS NULL;
GRANT ALL ON public.learning_companies TO service_role;
GRANT ALL ON public.learning_company_memberships TO service_role;

-- 2. Funções de acesso
CREATE OR REPLACE FUNCTION public.default_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM learning_companies WHERE slug='nexti' $$;

CREATE OR REPLACE FUNCTION public.is_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='master') $$;

CREATE OR REPLACE FUNCTION public.user_company_id(_user uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT company_id FROM learning_company_memberships WHERE user_id=_user AND revoked_at IS NULL LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.user_company_id(auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _company IS NOT NULL AND (public.is_master() OR EXISTS(
    SELECT 1 FROM learning_company_memberships WHERE user_id=auth.uid() AND company_id=_company AND revoked_at IS NULL AND role='admin')) $$;

CREATE OR REPLACE FUNCTION public.can_see_user(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _user = auth.uid() OR public.is_master() OR (public.user_company_id(_user) IS NOT DISTINCT FROM public.current_company_id() AND public.current_company_id() IS NOT NULL) $$;

CREATE OR REPLACE FUNCTION public.can_admin_user(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_master() OR public.is_company_admin(public.user_company_id(_user)) $$;

-- 3. Cursos com dono
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.learning_companies(id) DEFAULT COALESCE(public.current_company_id(), public.default_company_id());
UPDATE public.tracks SET company_id = public.default_company_id() WHERE company_id IS NULL;
ALTER TABLE public.tracks ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS tracks_company_id_idx ON public.tracks(company_id);

CREATE TABLE IF NOT EXISTS public.track_company_access(
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.learning_companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, company_id));
GRANT SELECT, INSERT, DELETE ON public.track_company_access TO authenticated;
GRANT ALL ON public.track_company_access TO service_role;
ALTER TABLE public.track_company_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY tca_read ON public.track_company_access FOR SELECT TO authenticated USING (public.is_master() OR company_id = public.current_company_id());
CREATE POLICY tca_master_write ON public.track_company_access FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE INDEX IF NOT EXISTS tca_company_idx ON public.track_company_access(company_id);

CREATE OR REPLACE FUNCTION public.track_visible(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _track IS NULL OR public.is_master() OR EXISTS(SELECT 1 FROM tracks t WHERE t.id=_track AND (
    t.company_id = public.current_company_id() OR EXISTS(SELECT 1 FROM track_company_access a WHERE a.track_id=t.id AND a.company_id=public.current_company_id()))) $$;

CREATE OR REPLACE FUNCTION public.track_editable(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN _track IS NULL THEN public.is_master() OR public.has_role(auth.uid(),'admin')
    ELSE EXISTS(SELECT 1 FROM tracks t WHERE t.id=_track AND public.is_company_admin(t.company_id)) END $$;

CREATE OR REPLACE FUNCTION public.module_track(_m uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT track_id FROM course_modules WHERE id=_m $$;
CREATE OR REPLACE FUNCTION public.lesson_track(_l uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT track_id FROM lessons WHERE id=_l $$;
CREATE OR REPLACE FUNCTION public.exam_track(_e uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT track_id FROM exams WHERE id=_e $$;
CREATE OR REPLACE FUNCTION public.quiz_track(_q uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT track_id FROM quizzes WHERE id=_q $$;

-- tracks: leitura e escrita restritas ao ambiente
CREATE POLICY env_tracks_read ON public.tracks AS RESTRICTIVE FOR SELECT TO authenticated USING (public.track_visible(id));
CREATE POLICY env_tracks_ins ON public.tracks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY env_tracks_upd ON public.tracks AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY env_tracks_del ON public.tracks AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_company_admin(company_id));
CREATE POLICY env_tracks_admin ON public.tracks FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('lessons','track_id'),('course_modules','track_id'),('quizzes','track_id'),('exams','track_id'),
    ('module_materials','public.module_track(module_id)'),('lesson_materials','public.lesson_track(lesson_id)'),
    ('exam_questions','public.exam_track(exam_id)'),('quiz_questions','public.quiz_track(quiz_id)')) v(t, e)
  LOOP
    EXECUTE format('CREATE POLICY env_%1$s_read ON public.%1$I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.track_visible(%2$s))', r.t, r.e);
    EXECUTE format('CREATE POLICY env_%1$s_ins ON public.%1$I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.track_editable(%2$s))', r.t, r.e);
    EXECUTE format('CREATE POLICY env_%1$s_upd ON public.%1$I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.track_editable(%2$s)) WITH CHECK (public.track_editable(%2$s))', r.t, r.e);
    EXECUTE format('CREATE POLICY env_%1$s_del ON public.%1$I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.track_editable(%2$s))', r.t, r.e);
    EXECUTE format('CREATE POLICY env_%1$s_admin ON public.%1$I FOR ALL TO authenticated USING (%2$s IS NOT NULL AND public.track_editable(%2$s)) WITH CHECK (%2$s IS NOT NULL AND public.track_editable(%2$s))', r.t, r.e);
  END LOOP;

  -- dados de pessoas: ninguém cruza ambientes, exceto o Master
  FOR r IN SELECT unnest(ARRAY['profiles','enrollments','lesson_progress','certificates','exam_attempts','exam_sessions','quiz_attempts','kb_quiz_attempts','coin_transactions','reward_redemptions','user_badges','user_levels','user_streaks','training_requests','survey_responses','forum_posts','track_ratings']) AS t
  LOOP
    EXECUTE format('CREATE POLICY env_%1$s_read ON public.%1$I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_see_user(user_id))', r.t);
    EXECUTE format('CREATE POLICY env_%1$s_ins ON public.%1$I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_see_user(user_id))', r.t);
    EXECUTE format('CREATE POLICY env_%1$s_upd ON public.%1$I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_see_user(user_id))', r.t);
    EXECUTE format('CREATE POLICY env_%1$s_del ON public.%1$I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_see_user(user_id))', r.t);
  END LOOP;

  FOR r IN SELECT unnest(ARRAY['profiles','lesson_progress','certificates','exam_attempts','quiz_attempts','user_levels','coin_transactions']) AS t
  LOOP
    EXECUTE format('CREATE POLICY env_%1$s_company_admin_read ON public.%1$I FOR SELECT TO authenticated USING (public.can_admin_user(user_id))', r.t);
  END LOOP;
END $$;

CREATE POLICY env_enrollments_company_admin ON public.enrollments FOR ALL TO authenticated USING (public.can_admin_user(user_id)) WITH CHECK (public.can_admin_user(user_id));

-- ambientes e vínculos: só o Master altera; cada um lê o seu
DROP POLICY IF EXISTS companies_admin ON public.learning_companies;
CREATE POLICY companies_master ON public.learning_companies FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY companies_read ON public.learning_companies FOR SELECT TO authenticated USING (id = public.current_company_id() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS memberships_admin ON public.learning_company_memberships;
CREATE POLICY memberships_master ON public.learning_company_memberships FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY memberships_read ON public.learning_company_memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_company_admin(company_id));

-- papéis: admin comum não pode mais conceder papéis; só o Master
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Masters manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

-- 4. Dados iniciais
INSERT INTO public.learning_company_memberships(user_id, company_id, validated_by, validated_at, role)
SELECT p.user_id, public.default_company_id(), p.user_id, now(),
  CASE WHEN EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role='admin') THEN 'admin' ELSE 'member' END
FROM public.profiles p
WHERE NOT EXISTS(SELECT 1 FROM public.learning_company_memberships m WHERE m.user_id=p.user_id AND m.revoked_at IS NULL)
ON CONFLICT (user_id, company_id) DO UPDATE SET revoked_at = NULL, role = EXCLUDED.role;

INSERT INTO public.user_roles(user_id, role)
SELECT user_id, 'master' FROM public.profiles WHERE lower(email) IN ('robson@nexti.com','aline.rodriguez@nexti.com')
ON CONFLICT DO NOTHING;

-- 5. Novo cadastro entra no ambiente Nexti como usuário comum
CREATE OR REPLACE FUNCTION public.assign_default_environment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM learning_company_memberships WHERE user_id=NEW.user_id AND revoked_at IS NULL) AND public.default_company_id() IS NOT NULL THEN
    INSERT INTO learning_company_memberships(user_id, company_id, validated_by, validated_at, role)
    VALUES (NEW.user_id, public.default_company_id(), NEW.user_id, now(), 'member')
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_default_environment ON public.profiles;
CREATE TRIGGER assign_default_environment AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_default_environment();

-- 6. RPCs
CREATE OR REPLACE FUNCTION public.my_environment() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('company_id', m.company_id, 'company_name', c.name, 'role', m.role, 'is_master', public.is_master())
  FROM (SELECT 1) x LEFT JOIN learning_company_memberships m ON m.user_id=auth.uid() AND m.revoked_at IS NULL
  LEFT JOIN learning_companies c ON c.id=m.company_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.company_members(_company uuid)
RETURNS TABLE(user_id uuid, nome text, email text, cargo text, role text, active boolean, is_master boolean, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_company_admin(_company) THEN RAISE EXCEPTION 'Sem permissão para este ambiente'; END IF;
  RETURN QUERY SELECT m.user_id, p.nome, p.email, p.cargo, m.role, m.revoked_at IS NULL,
    EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=m.user_id AND r.role='master'), m.validated_at
  FROM learning_company_memberships m LEFT JOIN profiles p ON p.user_id=m.user_id
  WHERE m.company_id=_company ORDER BY m.revoked_at IS NOT NULL, p.nome;
END $$;

CREATE OR REPLACE FUNCTION public.set_member_access(_user uuid, _company uuid, _role text, _active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_company_admin(_company) THEN RAISE EXCEPTION 'Sem permissão para este ambiente'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o seu próprio acesso'; END IF;
  IF EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user AND role='master') AND NOT public.is_master() THEN RAISE EXCEPTION 'Sem permissão para alterar este usuário'; END IF;
  IF NOT EXISTS(SELECT 1 FROM learning_company_memberships WHERE user_id=_user AND company_id=_company) THEN RAISE EXCEPTION 'Usuário não pertence a este ambiente'; END IF;
  IF _active AND EXISTS(SELECT 1 FROM learning_company_memberships WHERE user_id=_user AND company_id<>_company AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Usuário já está ativo em outro ambiente'; END IF;
  UPDATE learning_company_memberships SET role=_role, revoked_at = CASE WHEN _active THEN NULL ELSE COALESCE(revoked_at, now()) END
   WHERE user_id=_user AND company_id=_company;
  UPDATE profiles SET is_active=_active WHERE user_id=_user;
END $$;

CREATE OR REPLACE FUNCTION public.master_move_user(_user uuid, _company uuid, _role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_master() THEN RAISE EXCEPTION 'Apenas o Master'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
  UPDATE learning_company_memberships SET revoked_at=now() WHERE user_id=_user AND company_id<>_company AND revoked_at IS NULL;
  INSERT INTO learning_company_memberships(user_id, company_id, validated_by, validated_at, role)
  VALUES (_user, _company, auth.uid(), now(), _role)
  ON CONFLICT (user_id, company_id) DO UPDATE SET revoked_at=NULL, role=EXCLUDED.role, validated_by=auth.uid(), validated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.master_set_track_access(_company uuid, _tracks uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_master() THEN RAISE EXCEPTION 'Apenas o Master'; END IF;
  DELETE FROM track_company_access WHERE company_id=_company AND NOT (track_id = ANY(COALESCE(_tracks,'{}')));
  INSERT INTO track_company_access(track_id, company_id)
  SELECT t.id, _company FROM tracks t WHERE t.id = ANY(COALESCE(_tracks,'{}')) AND t.company_id<>_company
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.master_environments_report(_start date, _end date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s timestamptz := COALESCE(_start, '1900-01-01')::timestamptz; e timestamptz := (COALESCE(_end, current_date) + 1)::timestamptz;
BEGIN
  IF NOT public.is_master() THEN RAISE EXCEPTION 'Apenas o Master'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.name) FROM (
    SELECT c.id, c.name, c.is_active,
      (SELECT count(*) FROM learning_company_memberships m WHERE m.company_id=c.id AND m.revoked_at IS NULL) AS users,
      (SELECT count(*) FROM learning_company_memberships m WHERE m.company_id=c.id AND m.revoked_at IS NULL AND m.role='admin') AS admins,
      (SELECT count(*) FROM learning_company_memberships m JOIN profiles p ON p.user_id=m.user_id WHERE m.company_id=c.id AND m.revoked_at IS NULL AND p.last_active_at >= s AND p.last_active_at < e) AS active_users,
      (SELECT count(*) FROM tracks t WHERE t.company_id=c.id) AS own_courses,
      (SELECT count(*) FROM track_company_access a WHERE a.company_id=c.id) AS shared_courses,
      (SELECT count(*) FROM enrollments en JOIN learning_company_memberships m ON m.user_id=en.user_id AND m.revoked_at IS NULL WHERE m.company_id=c.id AND en.enrolled_at >= s AND en.enrolled_at < e) AS enrollments,
      (SELECT count(*) FROM enrollments en JOIN learning_company_memberships m ON m.user_id=en.user_id AND m.revoked_at IS NULL WHERE m.company_id=c.id AND en.status='completed' AND COALESCE(en.completed_at, en.enrolled_at) >= s AND COALESCE(en.completed_at, en.enrolled_at) < e) AS completions,
      (SELECT count(*) FROM certificates ce JOIN learning_company_memberships m ON m.user_id=ce.user_id AND m.revoked_at IS NULL WHERE m.company_id=c.id AND ce.revoked_at IS NULL AND ce.issued_at >= s AND ce.issued_at < e) AS certificates,
      (SELECT count(*) FROM exam_attempts ea JOIN learning_company_memberships m ON m.user_id=ea.user_id AND m.revoked_at IS NULL WHERE m.company_id=c.id AND ea.passed IS TRUE AND ea.created_at >= s AND ea.created_at < e) AS exams_passed,
      (SELECT COALESCE(sum(ct.amount),0) FROM coin_transactions ct JOIN learning_company_memberships m ON m.user_id=ct.user_id AND m.revoked_at IS NULL WHERE m.company_id=c.id AND ct.amount > 0 AND ct.created_at >= s AND ct.created_at < e) AS coins
    FROM learning_companies c) x), '[]'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.company_members(uuid), public.set_member_access(uuid,uuid,text,boolean), public.master_move_user(uuid,uuid,text), public.master_set_track_access(uuid,uuid[]), public.master_environments_report(date,date), public.my_environment() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.company_members(uuid), public.set_member_access(uuid,uuid,text,boolean), public.master_move_user(uuid,uuid,text), public.master_set_track_access(uuid,uuid[]), public.master_environments_report(date,date), public.my_environment() TO authenticated;
