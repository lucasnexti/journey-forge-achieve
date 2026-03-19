
-- Favorites/wishlist
CREATE TABLE public.track_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, track_id)
);
ALTER TABLE public.track_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON public.track_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prerequisites: add column to tracks
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS prerequisite_track_id uuid REFERENCES public.tracks(id);

-- Scheduled publishing
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Onboarding completed flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests text[];
