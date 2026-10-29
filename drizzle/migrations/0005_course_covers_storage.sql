CREATE POLICY "Admins write course covers" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'course-covers' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'course-covers' AND public.has_role(auth.uid(),'admin'));