
-- Add unique constraint for enrollment upsert
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_user_track_unique UNIQUE (user_id, track_id);
