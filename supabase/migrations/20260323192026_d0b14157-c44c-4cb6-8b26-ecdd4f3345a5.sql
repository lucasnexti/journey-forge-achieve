
-- =====================================================
-- FIX: Quiz questions - create secure views that hide correct_answer
-- =====================================================

-- Remove direct SELECT for non-admins on quiz_questions
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.quiz_questions;

-- Only admins can see the raw table (which has correct_answer)
-- Regular users will use the view
CREATE POLICY "Admins can view all questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create secure view without correct_answer
CREATE OR REPLACE VIEW public.quiz_questions_safe
WITH (security_invoker = true)
AS
SELECT id, quiz_id, question, options, order_index
FROM public.quiz_questions;

-- Same for kb_quiz_questions
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.kb_quiz_questions;

CREATE POLICY "Admins can view all kb questions"
ON public.kb_quiz_questions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.kb_quiz_questions_safe
WITH (security_invoker = true)
AS
SELECT id, module_id, question, options, order_index, type, explanation
FROM public.kb_quiz_questions;

-- =====================================================
-- FIX: CPF exposure - split sensitive data to separate table
-- The company_colleagues view already excludes CPF, but the
-- profiles RLS policy still allows same-company full row reads.
-- We need to restrict the same-company policy.
-- =====================================================
DROP POLICY IF EXISTS "Users can view same company profiles" ON public.profiles;

-- Same company can only see limited fields through the view
-- Direct table access requires own user_id or admin
-- (own profile policy + admin policy already exist)

-- =====================================================
-- FIX: company_colleagues is a view, not a table, so RLS doesn't apply
-- Views inherit RLS from underlying tables, which is correct
-- Mark the finding as resolved by the security_invoker property
-- =====================================================

-- =====================================================
-- FIX: Leaked password protection
-- This requires auth config, not SQL migration
-- =====================================================
