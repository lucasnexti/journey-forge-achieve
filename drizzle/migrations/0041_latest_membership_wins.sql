CREATE OR REPLACE FUNCTION public.user_company_id(_user uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT company_id FROM learning_company_memberships WHERE user_id=_user AND revoked_at IS NULL
  ORDER BY validated_at DESC NULLS LAST LIMIT 1 $function$;

CREATE OR REPLACE FUNCTION public.my_environment()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('company_id', m.company_id, 'company_name', c.name, 'role', m.role, 'is_master', public.is_master())
  FROM (SELECT 1) x
  LEFT JOIN LATERAL (SELECT * FROM learning_company_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL ORDER BY validated_at DESC NULLS LAST LIMIT 1) m ON true
  LEFT JOIN learning_companies c ON c.id=m.company_id $function$;

CREATE OR REPLACE FUNCTION public.membership_latest_wins()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.revoked_at IS NULL THEN
    IF NEW.validated_at IS NULL THEN NEW.validated_at := now(); END IF;
    UPDATE learning_company_memberships SET revoked_at = now()
      WHERE user_id = NEW.user_id AND company_id <> NEW.company_id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_membership_latest_wins ON public.learning_company_memberships;
CREATE TRIGGER trg_membership_latest_wins BEFORE INSERT OR UPDATE OF revoked_at, company_id ON public.learning_company_memberships
FOR EACH ROW EXECUTE FUNCTION public.membership_latest_wins();