CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE TABLE public.notion_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL UNIQUE,
  parent_page_id text,
  kind text NOT NULL DEFAULT 'page' CHECK (kind IN ('page','database')),
  title text NOT NULL DEFAULT '',
  url text,
  depth integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  notion_last_edited timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','excluded')),
  audience text NOT NULL DEFAULT 'clientes' CHECK (audience IN ('clientes','admins')),
  linked_orientation_path text CHECK (linked_orientation_path IS NULL OR linked_orientation_path ~ '^[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$'),
  linked_orientation_title text,
  removed_at timestamptz,
  last_synced_at timestamptz,
  synced_edited_time timestamptz,
  sync_error text,
  unprocessed jsonb NOT NULL DEFAULT '[]'::jsonb,
  chunk_count integer NOT NULL DEFAULT 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notion_sources TO authenticated;
GRANT ALL ON public.notion_sources TO service_role;
ALTER TABLE public.notion_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view notion sources" ON public.notion_sources FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins review notion sources" ON public.notion_sources FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins may only change the review fields; everything else is written by the sync function.
CREATE OR REPLACE FUNCTION public.notion_sources_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.page_id IS DISTINCT FROM OLD.page_id OR NEW.parent_page_id IS DISTINCT FROM OLD.parent_page_id
       OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.title IS DISTINCT FROM OLD.title OR NEW.url IS DISTINCT FROM OLD.url
       OR NEW.depth IS DISTINCT FROM OLD.depth OR NEW.position IS DISTINCT FROM OLD.position
       OR NEW.notion_last_edited IS DISTINCT FROM OLD.notion_last_edited OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
       OR NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at OR NEW.synced_edited_time IS DISTINCT FROM OLD.synced_edited_time
       OR NEW.sync_error IS DISTINCT FROM OLD.sync_error OR NEW.unprocessed IS DISTINCT FROM OLD.unprocessed
       OR NEW.chunk_count IS DISTINCT FROM OLD.chunk_count OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Somente a aprovação, o público e a orientação equivalente podem ser alterados.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.audience IS DISTINCT FROM OLD.audience THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER notion_sources_guard BEFORE UPDATE ON public.notion_sources
  FOR EACH ROW EXECUTE FUNCTION public.notion_sources_guard();

CREATE TABLE public.notion_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.notion_sources(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_title text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  url text,
  page_updated_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  search tsvector,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notion_chunks TO authenticated;
GRANT ALL ON public.notion_chunks TO service_role;
ALTER TABLE public.notion_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view notion chunks" ON public.notion_chunks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX notion_chunks_search_idx ON public.notion_chunks USING gin(search);
CREATE INDEX notion_chunks_source_idx ON public.notion_chunks(source_id);

CREATE OR REPLACE FUNCTION public.notion_chunks_search_vector()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  NEW.search :=
    setweight(to_tsvector('portuguese', extensions.unaccent(coalesce(NEW.page_title,''))), 'A') ||
    setweight(to_tsvector('portuguese', extensions.unaccent(coalesce(NEW.section,''))), 'B') ||
    setweight(to_tsvector('portuguese', extensions.unaccent(coalesce(NEW.content,''))), 'C');
  RETURN NEW;
END $$;
CREATE TRIGGER notion_chunks_search_vector BEFORE INSERT OR UPDATE ON public.notion_chunks
  FOR EACH ROW EXECUTE FUNCTION public.notion_chunks_search_vector();

CREATE TABLE public.notion_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('inventory','sync')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pages_processed integer NOT NULL DEFAULT 0,
  pages_unchanged integer NOT NULL DEFAULT 0,
  pages_failed integer NOT NULL DEFAULT 0,
  pages_removed integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.notion_sync_runs TO authenticated;
GRANT ALL ON public.notion_sync_runs TO service_role;
ALTER TABLE public.notion_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view notion sync runs" ON public.notion_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.ai_assistant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  helpful boolean NOT NULL,
  source_page_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_assistant_feedback TO authenticated;
GRANT ALL ON public.ai_assistant_feedback TO service_role;
ALTER TABLE public.ai_assistant_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users rate assistant answers" ON public.ai_assistant_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND cardinality(source_page_ids) <= 10);
CREATE POLICY "Admins view assistant feedback" ON public.ai_assistant_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Retrieval: only approved, present pages; admin-only pages only when the caller is an admin.
CREATE OR REPLACE FUNCTION public.search_notion_knowledge(_query text, _include_admin boolean, _limit integer DEFAULT 8)
RETURNS TABLE (chunk_id uuid, page_id text, page_title text, section text, url text, page_updated_at timestamptz,
               content text, rank real, linked_orientation_path text, linked_orientation_title text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE q text; tsq tsquery;
BEGIN
  q := plainto_tsquery('portuguese', extensions.unaccent(coalesce(left(_query, 500),'')))::text;
  IF q IS NULL OR q = '' THEN RETURN; END IF;
  tsq := to_tsquery('portuguese', replace(q, ' & ', ' | '));
  RETURN QUERY
    SELECT c.id, c.page_id, c.page_title, c.section, c.url, c.page_updated_at, c.content,
           ts_rank_cd(c.search, tsq)::real AS rank, s.linked_orientation_path, s.linked_orientation_title
    FROM public.notion_chunks c
    JOIN public.notion_sources s ON s.id = c.source_id
    WHERE s.status = 'approved' AND s.removed_at IS NULL
      AND (s.audience = 'clientes' OR _include_admin)
      AND c.search @@ tsq
    ORDER BY rank DESC
    LIMIT greatest(1, least(coalesce(_limit, 8), 20));
END $$;
REVOKE ALL ON FUNCTION public.search_notion_knowledge(text, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_notion_knowledge(text, boolean, integer) TO service_role;

-- Atomic replacement of one page's chunks: a failed write keeps the previous version.
CREATE OR REPLACE FUNCTION public.replace_notion_chunks(_source_id uuid, _chunks jsonb, _edited timestamptz, _unprocessed jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.notion_chunks WHERE source_id = _source_id;
  INSERT INTO public.notion_chunks (source_id, page_id, page_title, section, url, page_updated_at, position, content)
  SELECT _source_id, x->>'page_id', coalesce(x->>'page_title',''), coalesce(x->>'section',''), x->>'url',
         nullif(x->>'page_updated_at','')::timestamptz, (x->>'position')::int, x->>'content'
  FROM jsonb_array_elements(coalesce(_chunks,'[]'::jsonb)) x
  WHERE coalesce(x->>'content','') <> '';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.notion_sources SET chunk_count = n, last_synced_at = now(), synced_edited_time = _edited,
         sync_error = NULL, unprocessed = coalesce(_unprocessed,'[]'::jsonb)
   WHERE id = _source_id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.replace_notion_chunks(uuid, jsonb, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_notion_chunks(uuid, jsonb, timestamptz, jsonb) TO service_role;