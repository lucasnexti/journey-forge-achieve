
-- Training modules table (managed by admin)
CREATE TABLE public.training_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration_hours NUMERIC NOT NULL DEFAULT 1,
  cost_per_hour NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'geral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Training requests table
CREATE TABLE public.training_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  preferred_date TEXT,
  participants INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;

-- Training modules: anyone authenticated can view active modules, admins can manage all
CREATE POLICY "Anyone authenticated can view active training modules"
  ON public.training_modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage training modules"
  ON public.training_modules FOR ALL TO public
  USING (public.has_role(auth.uid(), 'admin'));

-- Training requests: users can manage own, admins can manage all
CREATE POLICY "Users can insert own training requests"
  ON public.training_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own training requests"
  ON public.training_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all training requests"
  ON public.training_requests FOR ALL TO public
  USING (public.has_role(auth.uid(), 'admin'));
