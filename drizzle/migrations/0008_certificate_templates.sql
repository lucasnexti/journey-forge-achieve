CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  track_ids uuid[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage certificate templates" ON public.certificate_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_certificate_templates_updated BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS generation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS certificates_code_key ON public.certificates(certificate_code);

-- Public verification: only minimal data, via the official record.
CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'found', true,
      'valid', c.revoked_at IS NULL,
      'code', c.certificate_code,
      'course', t.title,
      'issued_at', c.issued_at,
      'student', split_part(p.nome, ' ', 1) || COALESCE(' ' || left(NULLIF(split_part(p.nome, ' ', 2), ''), 1) || '.', ''),
      'institution', 'Nexti Academy')
    FROM certificates c JOIN tracks t ON t.id = c.track_id
    LEFT JOIN profiles p ON p.user_id = c.user_id
    WHERE upper(c.certificate_code) = upper(trim(_code))
  ), jsonb_build_object('found', false))
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

CREATE POLICY "Admins manage certificate files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students read own certificate files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = 'issued' AND (storage.foldername(name))[2] = auth.uid()::text);