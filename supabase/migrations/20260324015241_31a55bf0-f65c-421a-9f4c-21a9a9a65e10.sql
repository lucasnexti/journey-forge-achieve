
-- Performance snapshots table for historical trends
CREATE TABLE public.performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  avg_response_ms numeric NOT NULL DEFAULT 0,
  p95_response_ms numeric NOT NULL DEFAULT 0,
  max_response_ms numeric NOT NULL DEFAULT 0,
  error_rate numeric NOT NULL DEFAULT 0,
  uptime_proxy numeric NOT NULL DEFAULT 100,
  slo_score integer NOT NULL DEFAULT 0,
  users_online integer NOT NULL DEFAULT 0,
  active_today integer NOT NULL DEFAULT 0,
  enrollments_total integer NOT NULL DEFAULT 0,
  lessons_completed_today integer NOT NULL DEFAULT 0,
  quiz_pass_rate numeric NOT NULL DEFAULT 0,
  video_availability numeric NOT NULL DEFAULT 0,
  content_completeness numeric NOT NULL DEFAULT 0,
  quiz_coverage numeric NOT NULL DEFAULT 0,
  throughput_lessons_hour integer NOT NULL DEFAULT 0,
  throughput_quizzes_hour integer NOT NULL DEFAULT 0,
  throughput_enrollments_hour integer NOT NULL DEFAULT 0,
  data_volume jsonb NOT NULL DEFAULT '{}'::jsonb,
  query_benchmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_time_ms numeric NOT NULL DEFAULT 0
);

-- Index for time-range queries
CREATE INDEX idx_performance_snapshots_captured_at ON public.performance_snapshots (captured_at DESC);

-- RLS
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view snapshots"
  ON public.performance_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
