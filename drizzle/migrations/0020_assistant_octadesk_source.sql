ALTER TABLE public.notion_sources ADD COLUMN provider text NOT NULL DEFAULT 'notion' CHECK (provider IN ('notion','octadesk'));
ALTER TABLE public.notion_chunks ADD COLUMN orientation_path text, ADD COLUMN orientation_title text;

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
       OR NEW.chunk_count IS DISTINCT FROM OLD.chunk_count OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.provider IS DISTINCT FROM OLD.provider THEN
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

DROP FUNCTION IF EXISTS public.search_notion_knowledge(text, boolean, text, integer);
CREATE FUNCTION public.search_notion_knowledge(_query text, _include_admin boolean, _module text DEFAULT NULL, _limit integer DEFAULT 8)
RETURNS TABLE (chunk_id uuid, page_id text, page_title text, section text, url text, page_updated_at timestamptz,
               content text, rank real, linked_orientation_path text, linked_orientation_title text, provider text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE q text; tsq tsquery;
BEGIN
  q := plainto_tsquery('portuguese', extensions.unaccent(coalesce(left(_query, 500),'')))::text;
  IF q IS NULL OR q = '' THEN RETURN; END IF;
  tsq := to_tsquery('portuguese', replace(q, ' & ', ' | '));
  RETURN QUERY
    SELECT r.id, r.page_id, r.page_title, r.section, r.url, r.page_updated_at, r.content, r.rank,
           r.opath, r.otitle, r.provider
    FROM (
      SELECT c.id, c.page_id, c.page_title, c.section, c.url, c.page_updated_at, c.content,
             ts_rank_cd(c.search, tsq)::real AS rank,
             coalesce(c.orientation_path, s.linked_orientation_path) AS opath,
             CASE WHEN c.orientation_path IS NOT NULL THEN c.orientation_title ELSE s.linked_orientation_title END AS otitle,
             s.provider,
             row_number() OVER (PARTITION BY c.source_id ORDER BY ts_rank_cd(c.search, tsq) DESC) AS rn
      FROM public.notion_chunks c
      JOIN public.notion_sources s ON s.id = c.source_id
      WHERE s.status = 'approved' AND s.removed_at IS NULL
        AND (s.audience = 'clientes' OR _include_admin)
        AND (_module IS NULL OR s.module IS NULL OR s.module = _module)
        AND c.search @@ tsq
    ) r
    WHERE r.rn <= 3
    ORDER BY r.rank DESC
    LIMIT greatest(1, least(coalesce(_limit, 8), 20));
END $$;
REVOKE ALL ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) TO service_role;