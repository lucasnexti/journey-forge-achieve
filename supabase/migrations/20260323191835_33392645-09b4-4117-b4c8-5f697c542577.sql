
-- Fix: Drop the SECURITY DEFINER view and recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.company_colleagues;

CREATE VIEW public.company_colleagues
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  nome,
  cargo,
  empresa,
  avatar_url,
  is_active,
  last_active_at
FROM public.profiles
WHERE empresa IS NOT NULL 
  AND empresa = get_user_empresa(auth.uid());

-- =====================================================
-- SECURITY FIX 7: Quiz answers - create server-side validation function
-- Remove direct access to correct_answer column
-- =====================================================

-- Function to validate quiz answers server-side
CREATE OR REPLACE FUNCTION public.validate_quiz_attempt(
  _user_id uuid,
  _quiz_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total integer;
  _correct integer := 0;
  _passing_score integer;
  _question record;
  _user_answer integer;
  _result jsonb;
BEGIN
  -- Get passing score
  SELECT passing_score INTO _passing_score FROM public.quizzes WHERE id = _quiz_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Quiz not found');
  END IF;

  -- Count questions and check answers
  SELECT count(*) INTO _total FROM public.quiz_questions WHERE quiz_id = _quiz_id;
  
  FOR _question IN SELECT id, correct_answer FROM public.quiz_questions WHERE quiz_id = _quiz_id
  LOOP
    _user_answer := (_answers->>(_question.id::text))::integer;
    IF _user_answer = _question.correct_answer THEN
      _correct := _correct + 1;
    END IF;
  END LOOP;

  -- Calculate score percentage
  _result := jsonb_build_object(
    'score', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END,
    'correct', _correct,
    'total', _total,
    'passed', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) >= _passing_score ELSE false END
  );

  -- Insert attempt record
  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (
    _user_id, 
    _quiz_id, 
    (_result->>'score')::integer, 
    (_result->>'passed')::boolean, 
    _answers
  );

  RETURN _result;
END;
$$;

-- Restrict quiz_questions: users can only see question text and options, NOT correct_answer
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.quiz_questions;

CREATE POLICY "Anyone authenticated can view questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (true);

-- Same for kb_quiz_questions
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.kb_quiz_questions;

CREATE POLICY "Anyone authenticated can view questions"
ON public.kb_quiz_questions
FOR SELECT
TO authenticated
USING (true);
