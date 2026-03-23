
-- Update validate_quiz_attempt to return details with correct answers
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
  _details jsonb := '[]'::jsonb;
BEGIN
  SELECT passing_score INTO _passing_score FROM public.quizzes WHERE id = _quiz_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Quiz not found');
  END IF;

  SELECT count(*) INTO _total FROM public.quiz_questions WHERE quiz_id = _quiz_id;
  
  FOR _question IN SELECT id, correct_answer FROM public.quiz_questions WHERE quiz_id = _quiz_id
  LOOP
    _user_answer := (_answers->>(_question.id::text))::integer;
    IF _user_answer IS NOT NULL AND _user_answer = _question.correct_answer THEN
      _correct := _correct + 1;
    END IF;
    _details := _details || jsonb_build_object(
      'question_id', _question.id,
      'correct_answer', _question.correct_answer,
      'user_answer', _user_answer,
      'is_correct', (_user_answer IS NOT NULL AND _user_answer = _question.correct_answer)
    );
  END LOOP;

  _result := jsonb_build_object(
    'score', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END,
    'correct', _correct,
    'total', _total,
    'passed', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) >= _passing_score ELSE false END,
    'details', _details
  );

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
