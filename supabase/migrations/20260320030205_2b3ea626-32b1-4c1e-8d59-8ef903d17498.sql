ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS timestamp_seconds integer DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_notes_lesson_user ON public.lesson_notes (lesson_id, user_id);