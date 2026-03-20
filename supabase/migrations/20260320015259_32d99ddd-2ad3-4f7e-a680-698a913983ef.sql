
-- ══════════════════════════════════════════════
-- GAMIFICATION: Coins, Levels, Streaks, Rewards
-- ══════════════════════════════════════════════

-- 1. Coin transactions ledger
CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  reference_type text, -- 'lesson', 'track', 'quiz', 'streak', 'daily', 'forum', 'redemption'
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_tx_user ON public.coin_transactions(user_id);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.coin_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.coin_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.coin_transactions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 2. User levels (XP-based)
CREATE TABLE public.user_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_xp integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own level"
  ON public.user_levels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own level"
  ON public.user_levels FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all levels"
  ON public.user_levels FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. User streaks
CREATE TABLE public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak"
  ON public.user_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streak"
  ON public.user_streaks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all streaks"
  ON public.user_streaks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. Rewards catalog (admin-managed)
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  cost integer NOT NULL,
  stock integer, -- NULL = unlimited
  is_active boolean NOT NULL DEFAULT true,
  category text DEFAULT 'geral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active rewards"
  ON public.rewards FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage rewards"
  ON public.rewards FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 5. Reward redemptions
CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards(id),
  cost integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'delivered', 'rejected'
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON public.reward_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own redemptions"
  ON public.reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all redemptions"
  ON public.reward_redemptions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 6. Function to get user coin balance
CREATE OR REPLACE FUNCTION public.get_user_coins(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.coin_transactions
  WHERE user_id = _user_id
$$;

-- 7. Function to calculate level from XP
CREATE OR REPLACE FUNCTION public.get_level_from_xp(_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _xp >= 2000 THEN 6
    WHEN _xp >= 1000 THEN 5
    WHEN _xp >= 600 THEN 4
    WHEN _xp >= 300 THEN 3
    WHEN _xp >= 100 THEN 2
    ELSE 1
  END
$$;
