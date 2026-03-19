
-- Allow authenticated users to insert their own enrollments
CREATE POLICY "Users can insert own enrollments"
ON public.enrollments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update own enrollments (e.g. mark completed)
CREATE POLICY "Users can update own enrollments"
ON public.enrollments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
