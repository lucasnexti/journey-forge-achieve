
ALTER TABLE public.training_modules ADD COLUMN cost_per_hour_remote numeric NOT NULL DEFAULT 0;

ALTER TABLE public.training_requests ADD COLUMN modality text NOT NULL DEFAULT 'presencial';
