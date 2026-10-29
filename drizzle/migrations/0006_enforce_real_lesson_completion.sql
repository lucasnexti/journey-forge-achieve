CREATE OR REPLACE FUNCTION public.enforce_lesson_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dur integer; _ltrack uuid;
  _old_ws integer := 0; _old_done boolean := false; _old_at timestamptz;
  _elapsed numeric := 0; _allowed integer;
BEGIN
  -- Only direct student API calls are restricted; trusted server functions run as owner.
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;

  SELECT duration, track_id INTO _dur, _ltrack FROM lessons WHERE id = NEW.lesson_id;
  IF _ltrack IS NULL THEN RAISE EXCEPTION 'lesson not found'; END IF;
  NEW.track_id := _ltrack;

  SELECT watched_seconds, completed, last_watched_at INTO _old_ws, _old_done, _old_at
    FROM lesson_progress WHERE user_id = NEW.user_id AND lesson_id = NEW.lesson_id;
  _old_ws := COALESCE(_old_ws, 0); _old_done := COALESCE(_old_done, false);
  IF _old_at IS NOT NULL THEN
    _elapsed := LEAST(GREATEST(EXTRACT(EPOCH FROM (now() - _old_at)), 0), 60);
  END IF;

  -- Watched time can only grow at real playback pace (up to 2x speed), never by seeking.
  _allowed := _old_ws + CEIL(_elapsed * 2.1)::int + 20;
  NEW.watched_seconds := GREATEST(_old_ws, LEAST(COALESCE(NEW.watched_seconds, 0), _allowed));
  IF COALESCE(_dur, 0) > 0 THEN NEW.watched_seconds := LEAST(NEW.watched_seconds, _dur); END IF;
  NEW.last_watched_at := now();

  -- Completion is decided here, not by the browser.
  IF _old_done THEN
    NEW.completed := true;
  ELSIF COALESCE(_dur, 0) > 0 AND NEW.watched_seconds >= CEIL(_dur * 0.9) THEN
    NEW.completed := true;
  ELSE
    NEW.completed := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_lesson_progress ON public.lesson_progress;
CREATE TRIGGER trg_enforce_lesson_progress BEFORE INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_progress();

-- Only completed rows count; the 90% shortcut is gone because the trigger now sets completed itself.
CREATE OR REPLACE FUNCTION public.has_completed_all_lessons(_user_id uuid, _track_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.lessons WHERE track_id = _track_id AND is_published) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.lessons l
       LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _user_id
       WHERE l.track_id = _track_id AND l.is_published
         AND COALESCE(lp.completed, false) = false
         AND NOT (COALESCE(l.duration, 0) > 0
                  AND COALESCE(lp.watched_seconds, 0) >= CEIL(l.duration * 0.9))
     )
$$;

-- Students cannot mark their own enrollment as completed.
CREATE OR REPLACE FUNCTION public.enforce_enrollment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN NEW.status := 'active'; END IF;
    NEW.completed_at := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_enrollment_status ON public.enrollments;
CREATE TRIGGER trg_enforce_enrollment_status BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.enforce_enrollment_status();

-- Courses without exam also get a real certificate record.
CREATE OR REPLACE FUNCTION public.complete_track_without_exam(_track_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _at timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.track_has_exam(_track_id) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'has_exam');
  END IF;
  IF NOT public.has_completed_all_lessons(_uid, _track_id) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'lessons_pending');
  END IF;
  INSERT INTO enrollments (user_id, track_id, status, completed_at)
  VALUES (_uid, _track_id, 'completed', now())
  ON CONFLICT (user_id, track_id) DO UPDATE
    SET status = 'completed', completed_at = COALESCE(enrollments.completed_at, now())
  RETURNING completed_at INTO _at;
  INSERT INTO certificates (user_id, track_id, certificate_code, issued_at)
  VALUES (_uid, _track_id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), _at)
  ON CONFLICT (user_id, track_id) DO NOTHING;
  RETURN jsonb_build_object('completed', true, 'completed_at', _at);
END $$;