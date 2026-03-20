-- Performance indexes for 10k+ users scale
CREATE INDEX IF NOT EXISTS idx_profiles_nome ON public.profiles USING btree (nome);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa ON public.profiles USING btree (empresa);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles USING btree (last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_track_id ON public.enrollments USING btree (track_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON public.enrollments USING btree (enrolled_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON public.lesson_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed ON public.lesson_progress USING btree (user_id, completed);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions USING btree (user_id);