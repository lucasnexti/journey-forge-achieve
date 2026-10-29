CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_modules_track ON public.course_modules(track_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage modules" ON public.course_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated view modules" ON public.course_modules FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_course_modules_updated_at BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.module_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'file',
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  external_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_module_materials_module ON public.module_materials(module_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_materials TO authenticated;
GRANT ALL ON public.module_materials TO service_role;
ALTER TABLE public.module_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage module materials" ON public.module_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated view module materials" ON public.module_materials FOR SELECT TO authenticated USING (true);

ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS instructor text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_lessons_module ON public.lessons(module_id, order_index);

INSERT INTO public.course_modules (track_id, title, order_index)
SELECT DISTINCT l.track_id, 'Módulo 1', 1 FROM public.lessons l
WHERE NOT EXISTS (SELECT 1 FROM public.course_modules m WHERE m.track_id = l.track_id);
UPDATE public.lessons l SET module_id = m.id
FROM public.course_modules m WHERE m.track_id = l.track_id AND l.module_id IS NULL;

CREATE POLICY "Admins write course materials" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'course-materials' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'course-materials' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated read course materials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-materials');