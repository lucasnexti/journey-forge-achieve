
-- Allow non-admin users to read questions via the safe views
-- We need a policy that allows authenticated users to read from the base table
-- but ONLY through the safe view. Since views use security_invoker, 
-- the underlying table policies apply. We need to allow SELECT but
-- the view only exposes safe columns.

-- Actually, the correct approach: allow SELECT on the table for authenticated users
-- since the VIEW controls which columns are visible. RLS controls ROW access, not columns.
-- The safe views handle column restriction.

-- Re-enable SELECT for authenticated users on quiz_questions
DROP POLICY IF EXISTS "Admins can view all questions" ON public.quiz_questions;

-- Admins full access (already exists via "Admins can manage questions")
-- Authenticated users can SELECT (but should use the safe view in app code)
CREATE POLICY "Authenticated can view questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can view all kb questions" ON public.kb_quiz_questions;

CREATE POLICY "Authenticated can view kb questions"
ON public.kb_quiz_questions
FOR SELECT
TO authenticated
USING (true);

-- Create KB quiz validation function (server-side)
CREATE OR REPLACE FUNCTION public.validate_kb_quiz_attempt(
  _user_id uuid,
  _module_ids uuid[],
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
  _question record;
  _user_answer integer;
  _results jsonb := '[]'::jsonb;
BEGIN
  FOR _question IN 
    SELECT id, correct_answer, explanation 
    FROM public.kb_quiz_questions 
    WHERE module_id = ANY(_module_ids)
  LOOP
    _user_answer := (_answers->>(_question.id::text))::integer;
    IF _user_answer IS NOT NULL AND _user_answer = _question.correct_answer THEN
      _correct := _correct + 1;
    END IF;
    _results := _results || jsonb_build_object(
      'question_id', _question.id,
      'correct_answer', _question.correct_answer,
      'user_answer', _user_answer,
      'is_correct', (_user_answer IS NOT NULL AND _user_answer = _question.correct_answer),
      'explanation', _question.explanation
    );
  END LOOP;

  _total := jsonb_array_length(_results);

  RETURN jsonb_build_object(
    'score', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END,
    'correct', _correct,
    'total', _total,
    'passed', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) >= 70 ELSE false END,
    'details', _results
  );
END;
$$;
