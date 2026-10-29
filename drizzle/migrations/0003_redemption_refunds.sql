ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_email_status text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coin_tx_redemption_refund
  ON public.coin_transactions (reference_id) WHERE reference_type = 'redemption_refund';

CREATE OR REPLACE FUNCTION public.admin_update_redemption(_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _admin uuid := auth.uid();
  _r record;
  _reward_name text;
  _refunded boolean := false;
  _allowed text[];
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF _status NOT IN ('pending','awaiting_address','ready_to_ship','shipped','delivered','rejected','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO _r FROM public.reward_redemptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  IF _r.status IN ('rejected','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_closed', 'status', _r.status);
  END IF;
  IF _r.status = 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_delivered');
  END IF;
  IF _r.status = 'shipped' AND _status NOT IN ('delivered') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_shipped');
  END IF;

  SELECT name INTO _reward_name FROM public.rewards WHERE id = _r.reward_id;

  UPDATE public.reward_redemptions
     SET status = _status,
         admin_note = COALESCE(NULLIF(trim(_reason), ''), admin_note),
         decision_reason = CASE WHEN _status IN ('rejected','cancelled') THEN NULLIF(trim(_reason), '') ELSE decision_reason END,
         decided_by = _admin, decided_at = now(), updated_at = now()
   WHERE id = _id;

  IF _status IN ('rejected','cancelled') AND _r.refunded_at IS NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason, reference_type, reference_id)
    VALUES (_r.user_id, _r.cost, 'Estorno de resgate de prêmio: ' || COALESCE(_reward_name, 'Prêmio'),
            'redemption_refund', _id::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      _refunded := true;
      UPDATE public.reward_redemptions SET refunded_at = now(), refund_email_status = 'pending' WHERE id = _id;
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (_r.user_id, 'Resgate não aprovado',
        'O resgate do prêmio ' || COALESCE(_reward_name,'') || ' não foi aprovado. Os ' || _r.cost ||
        ' pontos foram devolvidos ao seu saldo.' ||
        COALESCE(' Motivo: ' || NULLIF(trim(_reason), ''), ''), 'info');
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_admin, 'redemption.' || _status, 'reward_redemptions', _id::text,
    jsonb_build_object('from', _r.status, 'to', _status, 'reason', _reason, 'refunded', _refunded,
                       'amount', CASE WHEN _refunded THEN _r.cost ELSE 0 END, 'student', _r.user_id, 'reward', _reward_name));

  RETURN jsonb_build_object('ok', true, 'refunded', _refunded, 'amount', CASE WHEN _refunded THEN _r.cost ELSE 0 END);
END $$;

REVOKE ALL ON FUNCTION public.admin_update_redemption(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_redemption(uuid, text, text) TO authenticated;