ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.user_id AND p.email IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm ON public.profiles USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_nome_trgm ON public.profiles USING gin (nome gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, empresa, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'empresa', ''),
    NULLIF(NEW.raw_user_meta_data->>'cargo', '')
  );
  RETURN NEW;
END;
$function$;