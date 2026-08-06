CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON public.tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lessons_title_trgm ON public.lessons USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_title_trgm ON public.lesson_materials USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, created_at DESC) WHERE read = false;