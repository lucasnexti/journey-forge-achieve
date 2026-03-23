
-- Remove direct authenticated SELECT on quiz_questions (force use of safe views)
DROP POLICY IF EXISTS "Authenticated can view questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Authenticated can view kb questions" ON public.kb_quiz_questions;

-- Grant SELECT on the safe views to authenticated users via underlying table
-- The safe views use security_invoker, so we need a policy that allows
-- the view to read. We use a SECURITY DEFINER function approach instead.

-- Create wrapper functions for fetching questions safely
CREATE OR REPLACE FUNCTION public.get_quiz_questions(_quiz_id uuid)
RETURNS TABLE(id uuid, quiz_id uuid, question text, options jsonb, order_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, quiz_id, question, options, order_index
  FROM public.quiz_questions
  WHERE quiz_id = _quiz_id
  ORDER BY order_index;
$$;

CREATE OR REPLACE FUNCTION public.get_kb_quiz_questions(_module_ids uuid[])
RETURNS TABLE(id uuid, module_id uuid, question text, options jsonb, order_index integer, type text, explanation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, module_id, question, options, order_index, type, explanation
  FROM public.kb_quiz_questions
  WHERE module_id = ANY(_module_ids)
  ORDER BY order_index;
$$;
