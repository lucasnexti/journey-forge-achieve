
-- Survey definitions table
CREATE TABLE public.surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'nps' CHECK (type IN ('nps', 'csat')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('track_completion', 'login_milestone', 'periodic', 'manual')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  question TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Survey responses table
CREATE TABLE public.survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique constraint: one response per user per survey (can be relaxed if needed)
CREATE UNIQUE INDEX idx_survey_response_unique ON public.survey_responses(survey_id, user_id);

-- RLS for surveys
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage surveys" ON public.surveys
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view active surveys" ON public.surveys
  FOR SELECT TO authenticated USING (is_active = true);

-- RLS for survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own responses" ON public.survey_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.survey_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all responses" ON public.survey_responses
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage responses" ON public.survey_responses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
