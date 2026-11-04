ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text, ADD COLUMN IF NOT EXISTS workplace_empresa text;
COMMENT ON COLUMN public.profiles.workplace_empresa IS 'Self-reported workplace for personal data; never used for tenant authorization. empresa remains the managed access affiliation.';
CREATE OR REPLACE FUNCTION public.save_my_personal_data(_nome text, _email text, _telefone text, _empresa text, _cargo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE phone text := regexp_replace(coalesce(_telefone,''), '[^0-9]', '', 'g');
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
 IF btrim(coalesce(_nome,'')) = '' OR length(_nome)>255 THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
 IF btrim(coalesce(_email,'')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(_email)>255 THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;
 IF phone !~ '^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' THEN RAISE EXCEPTION 'Informe um telefone fixo ou celular válido com DDD.'; END IF;
 IF btrim(coalesce(_empresa,'')) = '' OR length(_empresa)>255 THEN RAISE EXCEPTION 'Informe a empresa em que trabalha.'; END IF;
 IF length(coalesce(_cargo,''))>255 THEN RAISE EXCEPTION 'Cargo deve ter até 255 caracteres.'; END IF;
 UPDATE public.profiles SET nome=btrim(_nome), email=btrim(_email), telefone=phone, workplace_empresa=btrim(_empresa), cargo=btrim(_cargo) WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.save_my_personal_data(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_personal_data(text,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_personal_contact() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.telefone IS DISTINCT FROM OLD.telefone OR NEW.workplace_empresa IS DISTINCT FROM OLD.workplace_empresa THEN
  IF btrim(coalesce(NEW.nome,''))='' THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  IF btrim(coalesce(NEW.email,'')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;
  NEW.telefone := regexp_replace(coalesce(NEW.telefone,''),'[^0-9]','','g');
  IF NEW.telefone !~ '^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' THEN RAISE EXCEPTION 'Informe um telefone fixo ou celular válido com DDD.'; END IF;
  IF btrim(coalesce(NEW.workplace_empresa,''))='' THEN RAISE EXCEPTION 'Informe a empresa em que trabalha.'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_personal_contact BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_personal_contact();