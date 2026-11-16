ALTER TABLE public.notion_sources ADD COLUMN IF NOT EXISTS viewer_url text
  CHECK (viewer_url IS NULL OR viewer_url ~ '^https://(drive\.google\.com/file/d/[A-Za-z0-9_-]+/preview|manuais-nexti\.pages\.dev/arquivos/[a-z0-9-]+(\.vertical)?\.(pdf|mp4))$');

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
       OR NEW.provider IS DISTINCT FROM OLD.provider OR NEW.viewer_url IS DISTINCT FROM OLD.viewer_url THEN
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