import { supabase } from "@/integrations/supabase/client";

/** Knowledge-base content key in public.knowledge_base_content. */
export const KB_ID = "nexti-na-pratica";

type KbRow = { dados: unknown; updated_at: string | null; can_edit: boolean };

/**
 * Exposed to the embedded static site (same origin) as window.parent.__nextiNaPratica.
 * Reads go through get_knowledge_base (drafts stripped for non-admins); publishing goes through
 * the admin-only save_knowledge_base RPC with a stale-edit check.
 */
export const nextiNaPraticaBridge = {
  async load() {
    const { data, error } = await supabase.rpc("get_knowledge_base", { _id: KB_ID });
    if (error) throw error;
    const r = (data ?? {}) as unknown as KbRow;
    return { dados: r.dados ?? null, updatedAt: r.updated_at ?? null, canEdit: !!r.can_edit };
  },
  async save(dados: unknown, expected: string | null) {
    const { data, error } = await supabase.rpc("save_knowledge_base", {
      _id: KB_ID,
      _dados: JSON.parse(JSON.stringify(dados)),
      _expected: expected as string,
    });
    if (error) throw new Error(error.message.includes("CONFLITO") ? "conflict" : error.message);
    return { updatedAt: data as string };
  },
};

export function installNextiNaPraticaBridge() {
  (window as unknown as { __nextiNaPratica?: typeof nextiNaPraticaBridge }).__nextiNaPratica = nextiNaPraticaBridge;
}
