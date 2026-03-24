
-- Alert rules configuration
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  operator text NOT NULL DEFAULT 'gte' CHECK (operator IN ('gte','lte','eq')),
  threshold numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  cooldown_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Alert history log
CREATE TABLE public.alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage alert rules"
  ON public.alert_rules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin can view alert history"
  ON public.alert_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
