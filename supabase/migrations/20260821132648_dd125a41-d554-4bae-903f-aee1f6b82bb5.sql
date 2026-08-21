-- ══════════════════════════════════════════
-- ANTI-FRAUDE: Nexti Coins e conquistas
-- ══════════════════════════════════════════

-- 1. Catálogo de regras (fonte única dos valores, no servidor)
CREATE TABLE IF NOT EXISTS public.coin_rules (
  key text PRIMARY KEY,
  label text NOT NULL,
  amount integer NOT NULL,
  reference_type text NOT NULL,
  daily_cap integer,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coin_rules TO authenticated;
GRANT ALL ON public.coin_rules TO service_role;
ALTER TABLE public.coin_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read coin rules" ON public.coin_rules;
CREATE POLICY "Anyone authenticated can read coin rules"
  ON public.coin_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage coin rules" ON public.coin_rules;
CREATE POLICY "Admins manage coin rules"
  ON public.coin_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.coin_rules (key, label, amount, reference_type) VALUES
  ('lesson_complete', 'Aula concluída', 10, 'lesson'),
  ('track_complete',  'Trilha concluída', 50, 'track'),
  ('exam_pass',       'Avaliação aprovada', 25, 'exam'),
  ('exam_perfect',    'Avaliação nota máxima', 40, 'exam'),
  ('quiz_pass',       'Quiz aprovado', 25, 'quiz'),
  ('quiz_perfect',    'Quiz nota máxima', 40, 'quiz'),
  ('daily_login',     'Acesso diário', 5, 'daily'),
  ('streak_3',        'Streak de 3 dias', 15, 'streak'),
  ('streak_7',        'Streak de 7 dias', 50, 'streak'),
  ('forum_post',      'Participação no fórum', 5, 'forum')
ON CONFLICT (key) DO NOTHING;

-- 2. Idempotência real no ledger (antes só existia checagem no cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_tx_unique_earn
  ON public.coin_transactions (user_id, reason, reference_id)
  WHERE reference_id IS NOT NULL AND amount > 0;

CREATE INDEX IF NOT EXISTS idx_coin_tx_created ON public.coin_transactions (created_at DESC);

-- 3. Fecha as RPCs abertas: só service_role / funções internas podem chamar
REVOKE ALL ON FUNCTION public.award_coins(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_xp(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_coins(uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer) TO service_role;

-- 4. Verificação de evidência: a conquista existe mesmo no banco?
CREATE OR REPLACE FUNCTION public.coin_evidence_ok(_user_id uuid, _key text, _reference_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF _user_id IS NULL OR _key IS NULL OR _reference_id IS NULL THEN RETURN false; END IF;

  CASE _key
    WHEN 'lesson_complete' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.lesson_progress lp
        JOIN public.lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = _user_id AND lp.lesson_id::text = _reference_id
          AND (lp.completed = true
               OR (COALESCE(l.duration,0) > 0 AND COALESCE(lp.watched_seconds,0) >= l.duration * 0.9))
      );

    WHEN 'track_complete' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = _user_id AND e.track_id::text = _reference_id AND e.status = 'completed'
      ) OR EXISTS (
        SELECT 1 FROM public.certificates c
        WHERE c.user_id = _user_id AND c.track_id::text = _reference_id
      );

    WHEN 'exam_pass' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.exam_attempts a
        WHERE a.user_id = _user_id AND a.track_id::text = _reference_id AND a.passed
      );

    WHEN 'exam_perfect' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.exam_attempts a
        WHERE a.user_id = _user_id AND a.track_id::text = _reference_id AND a.passed AND a.percent >= 100
      );

    WHEN 'quiz_pass' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.quiz_attempts q
        WHERE q.user_id = _user_id AND q.quiz_id::text = _reference_id AND q.passed
      ) OR EXISTS (
        SELECT 1 FROM public.kb_quiz_attempts k
        WHERE k.user_id = _user_id AND k.module_id::text = _reference_id AND k.passed
      );

    WHEN 'quiz_perfect' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.quiz_attempts q
        WHERE q.user_id = _user_id AND q.quiz_id::text = _reference_id AND q.score >= 100
      ) OR EXISTS (
        SELECT 1 FROM public.kb_quiz_attempts k
        WHERE k.user_id = _user_id AND k.module_id::text = _reference_id
          AND k.total_questions > 0 AND k.score >= k.total_questions
      );

    WHEN 'daily_login' THEN
      RETURN _reference_id = 'daily-' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
         AND EXISTS (
           SELECT 1 FROM public.user_streaks s
           WHERE s.user_id = _user_id AND s.last_active_date = CURRENT_DATE
         );

    WHEN 'streak_3' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.user_streaks s
        WHERE s.user_id = _user_id AND s.current_streak >= 3 AND s.last_active_date = CURRENT_DATE
      );

    WHEN 'streak_7' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.user_streaks s
        WHERE s.user_id = _user_id AND s.current_streak >= 7 AND s.last_active_date = CURRENT_DATE
      );

    WHEN 'forum_post' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.forum_posts f
        WHERE f.user_id = _user_id AND f.id::text = _reference_id AND length(f.content) >= 20
      );

    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.coin_evidence_ok(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_evidence_ok(uuid, text, text) TO authenticated, service_role;

-- 5. Única porta de entrada para ganhar moedas
CREATE OR REPLACE FUNCTION public.claim_coin_reward(_key text, _reference_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rule record;
  _earned_today integer;
  _inserted integer := 0;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;

  SELECT * INTO _rule FROM public.coin_rules WHERE key = _key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'unknown_rule'); END IF;

  IF NOT public.coin_evidence_ok(_uid, _key, _reference_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_evidence');
  END IF;

  -- teto diário global anti-abuso
  SELECT COALESCE(sum(amount), 0) INTO _earned_today
    FROM public.coin_transactions
   WHERE user_id = _uid AND amount > 0 AND created_at >= date_trunc('day', now());
  IF _earned_today >= 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_cap_reached');
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (_uid, _rule.amount, _rule.label, _rule.reference_type, _reference_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'amount', 0);
  END IF;

  PERFORM public.award_xp(_uid, _rule.amount);
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'amount', _rule.amount, 'reason', _rule.label);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_coin_reward(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_coin_reward(text, text) TO authenticated, service_role;

-- 6. Resgate de prêmio atômico (saldo e estoque validados no servidor)
CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _reward record;
  _balance integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':redeem', 0));

  SELECT * INTO _reward FROM public.rewards WHERE id = _reward_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'reward_unavailable'); END IF;
  IF _reward.stock IS NOT NULL AND _reward.stock <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'out_of_stock');
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO _balance
    FROM public.coin_transactions WHERE user_id = _uid;
  IF _balance < _reward.cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins', 'balance', _balance);
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (_uid, -_reward.cost, 'Resgate: ' || _reward.name, 'redemption', _reward_id::text);

  INSERT INTO public.reward_redemptions (user_id, reward_id, cost, status)
  VALUES (_uid, _reward_id, _reward.cost, 'pending');

  IF _reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock = stock - 1, updated_at = now() WHERE id = _reward_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', _balance - _reward.cost);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated, service_role;

-- 7. Ajuste manual só por admin, sempre auditado
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(_user_id uuid, _amount integer, _reason text, _reference_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF _amount = 0 OR abs(_amount) > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (_user_id, _amount, _reason, 'admin_adjust', COALESCE(_reference_id, _admin::text));

  IF _amount > 0 THEN PERFORM public.award_xp(_user_id, _amount); END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_admin, 'coins.adjust', 'coin_transactions', _user_id::text,
          jsonb_build_object('amount', _amount, 'reason', _reason, 'target_user', _user_id));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_coins(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(uuid, integer, text, text) TO authenticated, service_role;

-- 8. Concessão de badges validada no servidor (substitui insert pelo cliente)
CREATE OR REPLACE FUNCTION public.evaluate_user_badges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _b record;
  _earned jsonb := '[]'::jsonb;
  _qualifies boolean;
  _n integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;

  FOR _b IN
    SELECT * FROM public.badges b
    WHERE NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = _uid AND ub.badge_id = b.id)
  LOOP
    _qualifies := false;

    IF _b.criteria_type = 'track_completion' THEN
      SELECT count(*) INTO _n FROM public.enrollments WHERE user_id = _uid AND status = 'completed';
      _qualifies := _n >= COALESCE(_b.criteria_value, 1);

    ELSIF _b.criteria_type = 'perfect_quiz' THEN
      SELECT count(*) INTO _n FROM public.quiz_attempts WHERE user_id = _uid AND score >= 100;
      _qualifies := _n >= COALESCE(_b.criteria_value, 1);

    ELSIF _b.criteria_type = 'forum_posts' THEN
      SELECT count(*) INTO _n FROM public.forum_posts WHERE user_id = _uid;
      _qualifies := _n >= COALESCE(_b.criteria_value, 1);

    ELSIF _b.criteria_type = 'quiz_module_pass' THEN
      SELECT count(*) INTO _n FROM public.kb_quiz_attempts WHERE user_id = _uid AND passed;
      _qualifies := _n >= COALESCE(_b.criteria_value, 1);

    ELSIF _b.criteria_type = 'quiz_score' THEN
      SELECT count(*) INTO _n FROM public.kb_quiz_attempts
       WHERE user_id = _uid AND total_questions > 0
         AND round((score::numeric / total_questions) * 100) >= COALESCE(_b.criteria_value, 90);
      _qualifies := _n >= 1;
    END IF;

    IF _qualifies THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (_uid, _b.id)
      ON CONFLICT DO NOTHING;
      _earned := _earned || jsonb_build_object('id', _b.id, 'name', _b.name, 'icon', _b.icon);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'earned', _earned);
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_user_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_user_badges() TO authenticated, service_role;

-- impede que o próprio usuário se conceda badges pelo cliente
DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_unique ON public.user_badges (user_id, badge_id);

-- 9. Painel anti-fraude (admin)
CREATE OR REPLACE FUNCTION public.gamification_fraud_report(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => GREATEST(COALESCE(_days, 30), 1));
  _res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'since', _since,
    'totals', jsonb_build_object(
      'earned', COALESCE((SELECT sum(amount) FROM public.coin_transactions WHERE amount > 0 AND created_at >= _since), 0),
      'spent', COALESCE((SELECT -sum(amount) FROM public.coin_transactions WHERE amount < 0 AND created_at >= _since), 0),
      'transactions', (SELECT count(*) FROM public.coin_transactions WHERE created_at >= _since),
      'manual_adjustments', (SELECT count(*) FROM public.coin_transactions WHERE reference_type = 'admin_adjust' AND created_at >= _since)
    ),
    'unverified', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ct.id, ct.user_id, p.nome, ct.amount, ct.reason, ct.reference_type, ct.reference_id, ct.created_at
        FROM public.coin_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        LEFT JOIN public.coin_rules r ON r.reference_type = ct.reference_type AND r.label = ct.reason
        WHERE ct.amount > 0 AND ct.created_at >= _since
          AND ct.reference_type NOT IN ('admin_adjust', 'refund')
          AND (r.key IS NULL OR NOT public.coin_evidence_ok(ct.user_id, r.key, ct.reference_id))
        ORDER BY ct.created_at DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'negative_balances', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ct.user_id, p.nome, sum(ct.amount)::int AS balance
        FROM public.coin_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        GROUP BY 1, 2 HAVING sum(ct.amount) < 0
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'velocity_spikes', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ct.user_id, p.nome, date_trunc('hour', ct.created_at) AS hour,
               count(*)::int AS events, sum(ct.amount)::int AS coins
        FROM public.coin_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        WHERE ct.amount > 0 AND ct.created_at >= _since
        GROUP BY 1, 2, 3
        HAVING sum(ct.amount) >= 300 OR count(*) >= 40
        ORDER BY 5 DESC LIMIT 30
      ) x
    ), '[]'::jsonb),
    'top_earners', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ct.user_id, p.nome, p.empresa, sum(ct.amount)::int AS coins, count(*)::int AS events
        FROM public.coin_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        WHERE ct.amount > 0 AND ct.created_at >= _since
        GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 15
      ) x
    ), '[]'::jsonb),
    'manual_log', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ct.id, ct.user_id, p.nome, ct.amount, ct.reason, ct.created_at
        FROM public.coin_transactions ct
        LEFT JOIN public.profiles p ON p.user_id = ct.user_id
        WHERE ct.reference_type IN ('admin_adjust', 'refund') AND ct.created_at >= _since
        ORDER BY ct.created_at DESC LIMIT 30
      ) x
    ), '[]'::jsonb),
    'badges_without_evidence', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT ub.id, ub.user_id, p.nome, b.name AS badge, b.criteria_type, ub.earned_at
        FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        LEFT JOIN public.profiles p ON p.user_id = ub.user_id
        WHERE (b.criteria_type = 'track_completion'
                 AND (SELECT count(*) FROM public.enrollments e WHERE e.user_id = ub.user_id AND e.status = 'completed') < COALESCE(b.criteria_value, 1))
           OR (b.criteria_type = 'forum_posts'
                 AND (SELECT count(*) FROM public.forum_posts f WHERE f.user_id = ub.user_id) < COALESCE(b.criteria_value, 1))
           OR (b.criteria_type = 'perfect_quiz'
                 AND (SELECT count(*) FROM public.quiz_attempts q WHERE q.user_id = ub.user_id AND q.score >= 100) < COALESCE(b.criteria_value, 1))
        ORDER BY ub.earned_at DESC LIMIT 30
      ) x
    ), '[]'::jsonb)
  ) INTO _res;

  RETURN _res;
END;
$$;

REVOKE ALL ON FUNCTION public.gamification_fraud_report(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamification_fraud_report(integer) TO authenticated, service_role;