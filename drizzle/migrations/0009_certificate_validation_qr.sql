ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS revoked_reason text, ADD COLUMN IF NOT EXISTS revoked_by uuid;

CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'found', true,
      'valid', c.revoked_at IS NULL,
      'revoked', c.revoked_at IS NOT NULL,
      'revoked_at', c.revoked_at,
      'code', c.certificate_code,
      'course', t.title,
      'hours', t.estimated_hours,
      'completed_at', COALESCE(e.completed_at, c.issued_at),
      'issued_at', COALESCE(c.generated_at, c.issued_at),
      'student', regexp_replace(trim(p.nome), '\s+', ' ', 'g'),
      'institution', 'Nexti Academy')
    FROM certificates c JOIN tracks t ON t.id = c.track_id
    LEFT JOIN profiles p ON p.user_id = c.user_id
    LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.track_id = c.track_id
    WHERE upper(c.certificate_code) = upper(trim(_code))
    LIMIT 1
  ), jsonb_build_object('found', false))
$function$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_certificate(_id uuid, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _c certificates;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  IF coalesce(length(trim(_reason)),0) < 3 THEN RAISE EXCEPTION 'Informe o motivo da revogação'; END IF;
  SELECT * INTO _c FROM certificates WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Certificado não encontrado'; END IF;
  IF _c.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  UPDATE certificates SET revoked_at = now(), status = 'revoked', revoked_reason = trim(_reason), revoked_by = auth.uid() WHERE id = _id;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'revoke_certificate', 'certificate', _id::text, jsonb_build_object('code', _c.certificate_code, 'reason', trim(_reason)));
  RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.admin_revoke_certificate(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_certificate(uuid, text) TO authenticated;