
-- Quiz modules linked to KB sections
CREATE TABLE public.kb_quiz_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'book-open',
  playbook_section_title TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kb_quiz_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active modules"
  ON public.kb_quiz_modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage modules"
  ON public.kb_quiz_modules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz questions per module (mixed: multiple_choice + true_false)
CREATE TABLE public.kb_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.kb_quiz_modules(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kb_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view questions"
  ON public.kb_quiz_questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage questions"
  ON public.kb_quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User quiz attempts per module
CREATE TABLE public.kb_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.kb_quiz_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  answers JSONB DEFAULT '[]'::jsonb,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kb_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attempts"
  ON public.kb_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attempts"
  ON public.kb_quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
  ON public.kb_quiz_attempts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
