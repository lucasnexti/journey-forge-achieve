CREATE OR REPLACE FUNCTION public.search_notion_knowledge(_query text, _include_admin boolean, _module text DEFAULT NULL, _limit integer DEFAULT 8)
RETURNS TABLE (chunk_id uuid, page_id text, page_title text, section text, url text, page_updated_at timestamptz,
               content text, rank real, linked_orientation_path text, linked_orientation_title text, provider text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE q text; tsq tsquery; tsq_all tsquery;
BEGIN
  tsq_all := plainto_tsquery('portuguese', extensions.unaccent(coalesce(left(_query, 500),'')));
  q := tsq_all::text;
  IF q IS NULL OR q = '' THEN RETURN; END IF;
  tsq := to_tsquery('portuguese', replace(q, ' & ', ' | '));
  RETURN QUERY
    SELECT r.id, r.page_id, r.page_title, r.section, r.url, r.page_updated_at, r.content, r.score,
           r.opath, r.otitle, r.provider
    FROM (
      SELECT x.*, row_number() OVER (PARTITION BY x.source_id ORDER BY x.score DESC) AS rn
      FROM (
        SELECT c.id, c.source_id, c.page_id, c.page_title, c.section, c.url, c.page_updated_at, c.content,
               (ts_rank_cd(c.search, tsq)
                 * CASE WHEN c.search @@ tsq_all THEN 3 ELSE 1 END
                 * CASE WHEN c.orientation_path IS NOT NULL THEN 1.5 ELSE 1 END)::real AS score,
               coalesce(c.orientation_path, s.linked_orientation_path) AS opath,
               CASE WHEN c.orientation_path IS NOT NULL THEN c.orientation_title ELSE s.linked_orientation_title END AS otitle,
               s.provider
        FROM public.notion_chunks c
        JOIN public.notion_sources s ON s.id = c.source_id
        WHERE s.status = 'approved' AND s.removed_at IS NULL
          AND (s.audience = 'clientes' OR _include_admin)
          AND (_module IS NULL OR s.module IS NULL OR s.module = _module)
          AND c.search @@ tsq
      ) x
    ) r
    WHERE r.rn <= 5
    ORDER BY r.score DESC
    LIMIT greatest(1, least(coalesce(_limit, 10), 20));
END $$;
REVOKE ALL ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_notion_knowledge(text, boolean, text, integer) TO service_role;