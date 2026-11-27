CREATE OR REPLACE FUNCTION public.is_master()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='master')
     AND coalesce(auth.jwt()->>'aal','') = 'aal2' $function$;