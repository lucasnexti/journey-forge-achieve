-- Course content: permissive read rules now carry the same access predicate as the existing restrictive gates.
DROP POLICY IF EXISTS "Anyone authenticated can view active tracks" ON public.tracks;
CREATE POLICY "Authorized can view tracks" ON public.tracks FOR SELECT TO authenticated
  USING (public.can_access_learning_course(id));

DROP POLICY IF EXISTS "Anyone authenticated can view lessons" ON public.lessons;
CREATE POLICY "Authorized can view lessons" ON public.lessons FOR SELECT TO authenticated
  USING (public.can_access_learning_course(track_id) AND (is_published OR public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Authenticated view modules" ON public.course_modules;
CREATE POLICY "Authorized view modules" ON public.course_modules FOR SELECT TO authenticated
  USING (public.can_access_learning_course(track_id));

DROP POLICY IF EXISTS "Anyone authenticated can view quizzes" ON public.quizzes;
CREATE POLICY "Authorized can view quizzes" ON public.quizzes FOR SELECT TO authenticated
  USING (public.can_access_learning_course(track_id));

DROP POLICY IF EXISTS "Authenticated view module materials" ON public.module_materials;
CREATE POLICY "Authorized view module materials" ON public.module_materials FOR SELECT TO authenticated
  USING (public.learning_module_access(module_id) AND (lesson_id IS NULL OR public.learning_lesson_access(lesson_id)));

DROP POLICY IF EXISTS "Anyone authenticated can view materials" ON public.lesson_materials;
CREATE POLICY "Authorized can view materials" ON public.lesson_materials FOR SELECT TO authenticated
  USING (public.learning_lesson_access(lesson_id));

DROP POLICY IF EXISTS "Anyone authenticated can view posts" ON public.forum_posts;
CREATE POLICY "Authorized can view posts" ON public.forum_posts FOR SELECT TO authenticated
  USING (track_id IS NULL OR public.can_access_learning_course(track_id));

-- Catalogs: students only see active entries; admins keep full access through their manage policies.
DROP POLICY IF EXISTS "Anyone authenticated can view active modules" ON public.kb_quiz_modules;
CREATE POLICY "Authenticated can view active modules" ON public.kb_quiz_modules FOR SELECT TO authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Anyone authenticated can view active training modules" ON public.training_modules;
CREATE POLICY "Authenticated can view active training modules" ON public.training_modules FOR SELECT TO authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Anyone authenticated can read coin rules" ON public.coin_rules;
CREATE POLICY "Authenticated can read active coin rules" ON public.coin_rules FOR SELECT TO authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Anyone authenticated can view badges" ON public.badges;
CREATE POLICY "Signed-in users can view badges" ON public.badges FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Ratings: each student reads only their own rating (existing own-rating policy); admins keep full access.
DROP POLICY IF EXISTS "Anyone authenticated can view ratings" ON public.track_ratings;

-- Avatars bucket stays public for image links; listing/reading via the API is limited to the owner's folder or admins.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Owners and admins can read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );