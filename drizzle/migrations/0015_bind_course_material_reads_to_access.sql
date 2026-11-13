DROP POLICY IF EXISTS "Authenticated read course materials" ON storage.objects;
CREATE POLICY "Authorized read course materials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-materials' AND auth.uid() IS NOT NULL AND public.learning_material_file_access(name));