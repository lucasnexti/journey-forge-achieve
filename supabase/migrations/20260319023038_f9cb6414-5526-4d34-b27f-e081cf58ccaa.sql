
-- Lesson progress (replaces localStorage)
CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  watched_seconds integer DEFAULT 0,
  last_watched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lesson progress"
ON public.lesson_progress FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all lesson progress"
ON public.lesson_progress FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Same-company users can view lesson progress (for reports)
CREATE POLICY "Same company can view lesson progress"
ON public.lesson_progress FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.empresa IS NOT NULL
    AND p.empresa = get_user_empresa(auth.uid())
  )
);

-- Notes per lesson
CREATE TABLE public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes"
ON public.lesson_notes FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Lesson materials/attachments
CREATE TABLE public.lesson_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  type text DEFAULT 'pdf',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view materials"
ON public.lesson_materials FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage materials"
ON public.lesson_materials FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Track ratings/feedback
CREATE TABLE public.track_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, track_id)
);

ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ratings"
ON public.track_ratings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can view ratings"
ON public.track_ratings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all ratings"
ON public.track_ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add last_active_at to profiles for streak tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Enable realtime for lesson_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_progress;
