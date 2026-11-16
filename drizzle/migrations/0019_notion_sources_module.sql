ALTER TABLE public.notion_sources ADD COLUMN module text CHECK (module IS NULL OR module IN ('nexti','talent','admissao'));

DROP FUNCTION IF EXISTS public.search_notion_knowledge(text, boolean, integer);
CREATE OR REPLACE FUNCTION public.search_notion_knowledge(_query text, _include_admin boolean, _module text DEFAULT NULL, _limit integer DEFAULT 8)
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
      AND (_module IS NULL OR s.module IS NULL OR s.module = _module)
      AND c.search @@ tsq
    ORDER BY rank DESC
    LIMIT greatest(1, least(coalesce(_limit, 8), 20));
END $$;
REVOKE ALL ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) TO service_role;