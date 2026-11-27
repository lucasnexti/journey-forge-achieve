CREATE OR REPLACE FUNCTION public.is_corporate_email(_email text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT split_part(lower(trim(coalesce(_email,''))), '@', 2) <> ''
     AND split_part(lower(trim(_email)), '@', 2) NOT IN (
      'gmail.com','googlemail.com','hotmail.com','hotmail.com.br','outlook.com','outlook.com.br','live.com','live.com.br',
      'msn.com','yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com','aol.com','bol.com.br',
      'uol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com','r7.com','zipmail.com.br','protonmail.com',
      'proton.me','gmx.com','mail.com','yandex.com','zoho.com','tutanota.com') $$;

CREATE OR REPLACE FUNCTION public.enforce_corporate_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NOT public.is_corporate_email(NEW.email) THEN
    RAISE EXCEPTION 'Cadastro permitido apenas com e-mail corporativo';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_corporate_email() FROM anon, public, authenticated;

DROP TRIGGER IF EXISTS enforce_corporate_email ON auth.users;
CREATE TRIGGER enforce_corporate_email BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enforce_corporate_email();