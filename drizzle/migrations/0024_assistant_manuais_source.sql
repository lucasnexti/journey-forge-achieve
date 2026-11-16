ALTER TABLE public.notion_sources DROP CONSTRAINT IF EXISTS notion_sources_provider_check;
ALTER TABLE public.notion_sources ADD CONSTRAINT notion_sources_provider_check CHECK (provider IN ('notion','octadesk','manuais'));
ALTER TABLE public.notion_sync_runs DROP CONSTRAINT IF EXISTS notion_sync_runs_kind_check;
ALTER TABLE public.notion_sync_runs ADD CONSTRAINT notion_sync_runs_kind_check CHECK (kind IN ('inventory','sync','octadesk','manuais'));