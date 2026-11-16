ALTER TABLE public.notion_sync_runs DROP CONSTRAINT IF EXISTS notion_sync_runs_kind_check;
ALTER TABLE public.notion_sync_runs ADD CONSTRAINT notion_sync_runs_kind_check CHECK (kind IN ('inventory','sync','octadesk'));

CREATE OR REPLACE FUNCTION public.replace_notion_chunks(_source_id uuid, _chunks jsonb, _edited timestamptz, _unprocessed jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.notion_chunks WHERE source_id = _source_id;
  INSERT INTO public.notion_chunks (source_id, page_id, page_title, section, url, page_updated_at, position, content,
                                    orientation_path, orientation_title)
  SELECT _source_id, x->>'page_id', coalesce(x->>'page_title',''), coalesce(x->>'section',''), x->>'url',
         nullif(x->>'page_updated_at','')::timestamptz, (x->>'position')::int, x->>'content',
         nullif(x->>'orientation_path',''), nullif(x->>'orientation_title','')
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