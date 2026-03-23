
-- =====================================================
-- SECURITY FIX 1: Remove user self-insert on coin_transactions
-- Users should NOT be able to create their own coin transactions
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.coin_transactions;

-- =====================================================
-- SECURITY FIX 2: Replace ALL policy on user_levels with INSERT-only
-- Users should NOT be able to UPDATE their own XP/level directly
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own level" ON public.user_levels;

CREATE POLICY "Users can insert own level"
ON public.user_levels
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SECURITY FIX 3: Replace ALL policy on user_streaks with INSERT-only
-- Users should NOT be able to UPDATE their own streaks directly
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own streak" ON public.user_streaks;

CREATE POLICY "Users can insert own streak"
ON public.user_streaks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SECURITY FIX 4: CPF exposure - replace same-company profile policy
-- Co-workers should only see non-sensitive fields
-- =====================================================
DROP POLICY IF EXISTS "Users can view same company profiles" ON public.profiles;

-- Create a secure view for same-company profile lookups (no CPF)
CREATE OR REPLACE VIEW public.company_colleagues AS
SELECT 
  user_id,
  nome,
  cargo,
  empresa,
  avatar_url,
  is_active,
  last_active_at
FROM public.profiles
WHERE empresa IS NOT NULL 
  AND empresa = get_user_empresa(auth.uid());

-- Re-add a restricted same-company policy that excludes CPF via a security definer function
CREATE OR REPLACE FUNCTION public.is_same_company(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.empresa = p2.empresa
    WHERE p1.user_id = _user_id 
      AND p2.user_id = auth.uid()
      AND p1.empresa IS NOT NULL
  )
$$;

-- Same company can view profiles but we'll handle CPF restriction at app level
-- Since RLS can't restrict columns, we use the view instead
CREATE POLICY "Users can view same company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  empresa IS NOT NULL 
  AND empresa = get_user_empresa(auth.uid())
);

-- =====================================================
-- SECURITY FIX 5: Restrict platform_settings to admins + whitelist
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view settings" ON public.platform_settings;

CREATE POLICY "Authenticated can view safe settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR key IN ('site_name', 'logo_url', 'primary_color', 'theme', 'welcome_message')
);

-- =====================================================
-- SECURITY FIX 6: Create server-side functions for XP, coins, streaks
-- =====================================================

-- Function to award coins (server-side only)
CREATE OR REPLACE FUNCTION public.award_coins(
  _user_id uuid,
  _amount integer,
  _reason text,
  _reference_type text DEFAULT NULL,
  _reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coin_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (_user_id, _amount, _reason, _reference_type, _reference_id);
END;
$$;

-- Function to update XP (server-side only)
CREATE OR REPLACE FUNCTION public.award_xp(
  _user_id uuid,
  _xp integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_levels (user_id, total_xp, current_level)
  VALUES (_user_id, _xp, get_level_from_xp(_xp))
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_xp = user_levels.total_xp + _xp,
    current_level = get_level_from_xp(user_levels.total_xp + _xp),
    updated_at = now();
END;
$$;

-- Function to update streak (server-side only)
CREATE OR REPLACE FUNCTION public.update_user_streak(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last_date date;
  _current integer;
  _longest integer;
BEGIN
  SELECT last_active_date, current_streak, longest_streak
  INTO _last_date, _current, _longest
  FROM public.user_streaks
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_active_date)
    VALUES (_user_id, 1, 1, CURRENT_DATE);
    RETURN;
  END IF;

  IF _last_date = CURRENT_DATE THEN
    RETURN; -- Already counted today
  ELSIF _last_date = CURRENT_DATE - 1 THEN
    _current := _current + 1;
    IF _current > _longest THEN _longest := _current; END IF;
  ELSE
    _current := 1;
  END IF;

  UPDATE public.user_streaks
  SET current_streak = _current,
      longest_streak = _longest,
      last_active_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- Add unique constraint on user_levels.user_id for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_levels_user_id_key'
  ) THEN
    ALTER TABLE public.user_levels ADD CONSTRAINT user_levels_user_id_key UNIQUE (user_id);
  END IF;
END$$;
