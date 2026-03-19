
-- Function to get user's empresa securely
CREATE OR REPLACE FUNCTION public.get_user_empresa(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Policy: users can view profiles from same empresa (for reports)
CREATE POLICY "Users can view same company profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  empresa IS NOT NULL 
  AND empresa = get_user_empresa(auth.uid())
);

-- Policy: users can view enrollments of same-company users (for reports)
CREATE POLICY "Users can view same company enrollments"
ON public.enrollments FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p 
    WHERE p.empresa IS NOT NULL 
    AND p.empresa = get_user_empresa(auth.uid())
  )
);
