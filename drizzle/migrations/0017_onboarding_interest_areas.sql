ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interest_areas text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.profiles.interests IS 'DEPRECATED: replaced by interest_areas (Nexti onboarding areas)';

-- Validate each personal field only when it changes, so onboarding can set the workplace without a phone.
CREATE OR REPLACE FUNCTION public.validate_personal_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.telefone IS DISTINCT FROM OLD.telefone THEN
  IF btrim(coalesce(NEW.nome,''))='' THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  IF btrim(coalesce(NEW.email,'')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido.'; END IF;
  NEW.telefone := regexp_replace(coalesce(NEW.telefone,''),'[^0-9]','','g');
  IF NEW.telefone !~ '^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' THEN RAISE EXCEPTION 'Informe um telefone fixo ou celular válido com DDD.'; END IF;
 END IF;
 IF NEW.workplace_empresa IS DISTINCT FROM OLD.workplace_empresa AND btrim(coalesce(NEW.workplace_empresa,''))='' THEN
  RAISE EXCEPTION 'Informe a empresa em que trabalha.';
 END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(_nome text, _workplace_empresa text, _cargo text, _interest_areas text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
 allowed text[] := ARRAY['gestao_pessoas','departamento_pessoal','controle_jornada','escalas_frequencia','gestao_beneficios','admissao_digital','gestao_equipes','relatorios_indicadores','gestao_acessos','tecnologia_nexti'];
 areas text[];
 done_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
 IF length(coalesce(_nome,''))>255 OR length(coalesce(_workplace_empresa,''))>255 OR length(coalesce(_cargo,''))>255 THEN
  RAISE EXCEPTION 'Use até 255 caracteres.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT t.a ORDER BY t.a), '{}'::text[]) INTO areas FROM unnest(coalesce(_interest_areas,'{}'::text[])) AS t(a);
 IF NOT (areas <@ allowed) THEN RAISE EXCEPTION 'Área de interesse inválida.'; END IF;

 UPDATE public.profiles SET
  nome = coalesce(nullif(btrim(_nome),''), nome),
  workplace_empresa = coalesce(nullif(btrim(_workplace_empresa),''), workplace_empresa),
  cargo = coalesce(nullif(btrim(_cargo),''), cargo),
  interest_areas = areas,
  onboarding_completed = true,
  onboarding_completed_at = coalesce(onboarding_completed_at, now())
 WHERE user_id = auth.uid() AND onboarding_completed IS NOT TRUE
 RETURNING onboarding_completed_at INTO done_at;

 IF NOT FOUND THEN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) THEN
   RETURN jsonb_build_object('already_completed', true);
  END IF;
  RAISE EXCEPTION 'Perfil não encontrado.';
 END IF;
 RETURN jsonb_build_object('already_completed', false, 'completed_at', done_at);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text[]) TO authenticated;