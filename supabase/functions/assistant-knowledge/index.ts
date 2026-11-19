// Admin-only (plus the hourly scheduler): keeps the "Assistente dos manuais" base up to date.
//  - wiki: the Nexti Wiki (Outline) — collections and documents read with WIKI_API_KEY, incremental by updatedAt.
//  - octadesk / manuais: prepared public indexes in the private assistant-knowledge bucket.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { WikiError, WIKI_URL, wikiClient, type Wiki } from "./wiki.ts";
import { moduleForCollection, wikiPassages } from "./wiki-text.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ action: z.enum(["status", "sync_wiki", "scheduled_sync", "import_octadesk", "import_manuais"]) });
const TIME_BUDGET_MS = 110_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { action } = parsed.data;

  // Hourly scheduler: authenticated by the managed cron secret, never by a user session.
  if (action === "scheduled_sync") {
    const denied = authenticateCronRequest(req);
    if (denied) return denied;
    if (!Deno.env.get("WIKI_API_KEY")) return json({ status: "skipped", reason: "wiki_not_configured" });
    return await syncWiki(db, null);
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Faça login para continuar." }, 401);
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Somente administradores." }, 403);

  if (action === "import_octadesk") return await importPrepared(db, userData.user.id, OCTADESK);
  if (action === "import_manuais") return await importPrepared(db, userData.user.id, MANUAIS);
  if (action === "sync_wiki") return await syncWiki(db, userData.user.id);

  // status
  let wiki: Wiki;
  try {
    wiki = wikiClient();
  } catch (e) {
    return json({ connected: false, url: WIKI_URL, message: (e as Error).message });
  }
  try {
    const info = await wiki.call("auth.info");
    return json({ connected: true, url: WIKI_URL, team: info.data?.team?.name ?? null, user: info.data?.user?.name ?? null });
  } catch (e) {
    return json({ connected: false, url: WIKI_URL, message: (e as Error).message, status: (e as WikiError).status ?? null });
  }
});

interface Node {
  page_id: string; parent_page_id: string | null; kind: "collection" | "page"; title: string; url: string | null; depth: number;
  position: number; path: string[]; module: "talent" | "admissao" | null; doc_id?: string;
}

/**
 * Reads every collection and document the key can see, keeps the Wiki hierarchy (coleção › documento pai › documento),
 * re-reads only documents whose updatedAt changed, and retires documents that left the Wiki (only after a complete read).
 */
async function syncWiki(db: SupabaseClient, userId: string | null) {
  const started = Date.now();
  const { data: run } = await db.from("notion_sync_runs").insert({ kind: "wiki", started_by: userId }).select("id").single();
  const failures: { title: string; error: string }[] = [];
  const removed: string[] = [];
  const deauthorized: string[] = [];
  const pending: string[] = [];
  const processed: string[] = [];
  let unchanged = 0;
  let wiki: Wiki | null = null;
  const finish = async (status: string, details: Record<string, unknown>) => {
    await db.from("notion_sync_runs").update({
      status, finished_at: new Date().toISOString(), pages_processed: processed.length, pages_unchanged: unchanged,
      pages_failed: failures.length, pages_removed: removed.length + deauthorized.length,
      details: { ...details, wiki_calls: wiki?.calls ?? 0 },
    }).eq("id", run?.id);
    return json({ status, ...details, processed: processed.length, unchanged });
  };

  // 1. Inventory: collections, their document trees, and each document's last edit.
  const nodes = new Map<string, Node>();
  const docs = new Map<string, any>();
  let incomplete = false;
  try {
    wiki = wikiClient();
    const collections = await wiki.all("collections.list");
    let position = 0;
    for (const c of collections) {
      if (c.archivedAt || c.deletedAt) continue;
      const colId = `wiki:col:${c.id}`;
      const module = moduleForCollection(c.name ?? "");
      nodes.set(colId, { page_id: colId, parent_page_id: null, kind: "collection", title: c.name || "Sem título",
        url: c.url ? `${WIKI_URL}${c.url}` : null, depth: 0, position: position++, path: [c.name], module });
      let tree: any[] = [];
      try {
        tree = (await wiki.call("collections.documents", { id: c.id })).data ?? [];
      } catch (e) {
        if ((e as WikiError).fatal) throw e;
        failures.push({ title: c.name, error: (e as Error).message });
        incomplete = true; // a collection we could not read must not be treated as removed
        continue;
      }
      const walk = (list: any[], parent: string, depth: number, path: string[]) => {
        for (const d of list) {
          const id = `wiki:${d.id}`;
          if (nodes.has(id)) continue; // a document appears once even if linked twice
          const title = d.title || "Sem título";
          nodes.set(id, { page_id: id, parent_page_id: parent, kind: "page", title, url: d.url ? `${WIKI_URL}${d.url}` : null,
            depth, position: position++, path: [...path, title], module, doc_id: d.id });
          if (d.children?.length) walk(d.children, id, depth + 1, [...path, title]);
        }
      };
      walk(tree, colId, 1, [c.name]);
    }
    for (const d of await wiki.all("documents.list", {}, 20000)) docs.set(d.id, d);
  } catch (e) {
    const err = e as WikiError;
    return await finish("failed", { error: err.fatal ? `Não foi possível acessar o Wiki: ${err.message} A base anterior foi mantida.`
      : `Falha ao listar o Wiki: ${err.message} A base anterior foi mantida.` });
  }

  // 2. Save the structure. New items enter approved for customers; an admin's later review is kept.
  const { data: existing, error: exErr } = await db.from("notion_sources")
    .select("id,page_id,title,status,removed_at,chunk_count,synced_edited_time").eq("provider", "wiki");
  if (exErr) return await finish("failed", { error: exErr.message });
  const byPage = new Map((existing ?? []).map((e) => [e.page_id, e]));
  const ids = new Map<string, { id: string; status: string; chunk_count: number; synced_edited_time: string | null }>();
  for (const n of nodes.values()) {
    const d = n.doc_id ? docs.get(n.doc_id) : null;
    const base = { title: n.title, url: n.url, parent_page_id: n.parent_page_id, kind: n.kind, depth: n.depth, position: n.position,
      notion_last_edited: d?.updatedAt ?? null, removed_at: null };
    const ex = byPage.get(n.page_id);
    if (ex) {
      const { error } = await db.from("notion_sources").update(base).eq("id", ex.id);
      if (error) { failures.push({ title: n.title, error: error.message }); continue; }
      ids.set(n.page_id, { id: ex.id, status: ex.status, chunk_count: ex.chunk_count, synced_edited_time: ex.synced_edited_time });
    } else {
      const { data, error } = await db.from("notion_sources").insert({ ...base, provider: "wiki", page_id: n.page_id,
        status: "approved", audience: "clientes", module: n.module }).select("id").single();
      if (error || !data) { failures.push({ title: n.title, error: error?.message ?? "falha ao salvar" }); continue; }
      ids.set(n.page_id, { id: data.id, status: "approved", chunk_count: 0, synced_edited_time: null });
    }
  }

  // 3. Documents that left the Wiki (or the key's reach) leave the answers — only after a complete read.
  if (!incomplete && !failures.length) {
    for (const e of existing ?? []) {
      if (nodes.has(e.page_id) || e.removed_at) continue;
      await db.from("notion_chunks").delete().eq("source_id", e.id);
      await db.from("notion_sources").update({ removed_at: new Date().toISOString(), chunk_count: 0, synced_edited_time: null }).eq("id", e.id);
      removed.push(e.title);
    }
  }
  // Items an admin excluded stop answering.
  for (const e of existing ?? []) {
    if (e.status !== "approved" && e.chunk_count > 0) {
      await db.from("notion_chunks").delete().eq("source_id", e.id);
      await db.from("notion_sources").update({ chunk_count: 0, synced_edited_time: null }).eq("id", e.id);
      deauthorized.push(e.title);
    }
  }

  // 4. Read the content of approved documents that are new or changed since the last sync.
  for (const n of nodes.values()) {
    if (n.kind !== "page") continue;
    const s = ids.get(n.page_id);
    if (!s || s.status !== "approved") continue;
    let d = docs.get(n.doc_id!);
    const edited = d?.updatedAt ?? null;
    if (edited && s.synced_edited_time && new Date(edited).getTime() === new Date(s.synced_edited_time).getTime()) {
      unchanged++;
      continue;
    }
    if (Date.now() - started > TIME_BUDGET_MS) { pending.push(n.title); continue; }
    try {
      if (typeof d?.text !== "string") d = (await wiki!.call("documents.info", { id: n.doc_id })).data;
      const { passages, unprocessed } = wikiPassages(d?.text ?? "", n.path);
      const chunks = passages.map((p, i) => ({ ...p, page_id: n.page_id, page_title: n.title, url: n.url,
        page_updated_at: d?.updatedAt ?? edited, position: i }));
      const { error } = await db.rpc("replace_notion_chunks", { _source_id: s.id, _chunks: chunks,
        _edited: d?.updatedAt ?? edited, _unprocessed: unprocessed });
      if (error) throw new Error(error.message);
      processed.push(n.title);
    } catch (e) {
      const err = e as WikiError;
      if (err.fatal) return await finish("failed", { error: "O Wiki deixou de aceitar a chave durante a leitura. A base anterior foi mantida.",
        failures, removed, deauthorized });
      if (err.gone) {
        await db.from("notion_chunks").delete().eq("source_id", s.id);
        await db.from("notion_sources").update({ removed_at: new Date().toISOString(), chunk_count: 0, synced_edited_time: null }).eq("id", s.id);
        removed.push(n.title);
        continue;
      }
      failures.push({ title: n.title, error: err.message });
      await db.from("notion_sources").update({ sync_error: err.message.slice(0, 500) }).eq("id", s.id);
    }
  }
  const status = failures.length || pending.length || incomplete ? "partial" : "success";
  return await finish(status, { collections: [...nodes.values()].filter((n) => n.kind === "collection").length,
    documents: [...nodes.values()].filter((n) => n.kind === "page").length, failures, removed, deauthorized, pending, incomplete,
    titles: processed.slice(0, 50) });
}

// Prepared public bases (text read from each manual's PDF, plus, for Octadesk, the Nexti na Prática orientations made
// from it) live in the private assistant-knowledge bucket. New manuals start approved for customers; an admin's later
// review (status, audience, module) is kept on re-import.
//  - octadesk: https://nexti.octadesk.com/kb/ (scripts/assistant-octadesk)
//  - manuais:  https://manuais-nexti.pages.dev/ "Manuais de implantação" (scripts/assistant-manuais)
const OctaChunk = z.object({
  section: z.string().max(300), content: z.string().min(1).max(4000),
  orientation_path: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/).nullable(), orientation_title: z.string().max(300).nullable(),
});
type PreparedBase = { provider: "octadesk" | "manuais"; file: string; label: string; source: string; pageId: RegExp; urlPrefix: string };
const OCTADESK: PreparedBase = { provider: "octadesk", file: "octadesk/index.json", label: "Octadesk", source: "https://nexti.octadesk.com/kb/",
  pageId: /^octadesk:[a-z0-9-]+$/, urlPrefix: "https://nexti.octadesk.com/kb/article/" };
const MANUAIS: PreparedBase = { provider: "manuais", file: "manuais/index.json", label: "dos manuais de implantação",
  source: "https://manuais-nexti.pages.dev/", pageId: /^manuais:[a-z0-9-]+$/, urlPrefix: "https://manuais-nexti.pages.dev/?manual=" };
// Same rule as the database check on notion_sources.viewer_url.
const VIEWER_URL = /^https:\/\/(drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview|manuais-nexti\.pages\.dev\/arquivos\/[a-z0-9-]+(\.vertical)?\.(pdf|mp4))$/;
const preparedIndex = (b: PreparedBase) => z.object({
  source: z.literal(b.source), generated_at: z.string(),
  articles: z.array(z.object({
    page_id: z.string().regex(b.pageId), title: z.string().min(1).max(300),
    url: z.string().startsWith(b.urlPrefix), module: z.enum(["nexti", "talent", "admissao"]),
    position: z.number().int(), linked_orientation_path: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/).nullable(),
    linked_orientation_title: z.string().nullable(), unprocessed: z.array(z.any()).max(20), chunks: z.array(OctaChunk).max(400),
    viewer_url: z.string().regex(VIEWER_URL).nullable().optional(),
  })).min(1).max(500),
});

async function importPrepared(db: SupabaseClient, userId: string, b: PreparedBase) {
  const { data: run } = await db.from("notion_sync_runs").insert({ kind: b.provider, started_by: userId }).select("id").single();
  const finish = async (status: string, details: Record<string, unknown>, counts: Record<string, number> = {}) => {
    await db.from("notion_sync_runs").update({ status, finished_at: new Date().toISOString(), details, ...counts }).eq("id", run?.id);
    return json({ status, ...details });
  };
  const { data: file, error: dlErr } = await db.storage.from("assistant-knowledge").download(b.file);
  if (dlErr || !file) return await finish("failed", { error: `Arquivo da base ${b.label} não encontrado.` });
  const parsed = preparedIndex(b).safeParse(JSON.parse(await file.text()));
  if (!parsed.success) return await finish("failed", { error: `Arquivo da base ${b.label} inválido.` });

  const { data: existing } = await db.from("notion_sources").select("id,page_id,title").eq("provider", b.provider);
  const byPage = new Map((existing ?? []).map((e) => [e.page_id, e]));
  const failures: { title: string; error: string }[] = [];
  let processed = 0;
  const offset = b.provider === "octadesk" ? 100000 : 200000;
  for (const a of parsed.data.articles) {
    const base = { title: a.title, url: a.url, position: offset + a.position, removed_at: null,
      linked_orientation_path: a.linked_orientation_path, linked_orientation_title: a.linked_orientation_title,
      ...(a.viewer_url ? { viewer_url: a.viewer_url } : {}) };
    let id = byPage.get(a.page_id)?.id;
    if (id) {
      const { error } = await db.from("notion_sources").update(base).eq("id", id);
      if (error) { failures.push({ title: a.title, error: error.message }); continue; }
    } else {
      const { data, error } = await db.from("notion_sources").insert({ ...base, provider: b.provider, page_id: a.page_id,
        status: "approved", audience: "clientes", module: a.module }).select("id").single();
      if (error || !data) { failures.push({ title: a.title, error: error?.message ?? "falha ao criar" }); continue; }
      id = data.id;
    }
    const chunks = a.chunks.map((c, i) => ({ ...c, page_id: a.page_id, page_title: a.title, url: a.url, position: i }));
    const { error } = await db.rpc("replace_notion_chunks", { _source_id: id, _chunks: chunks, _edited: null, _unprocessed: a.unprocessed });
    if (error) failures.push({ title: a.title, error: error.message }); else processed++;
  }
  // Manuals that left the base leave the answers (only when the whole import worked).
  const removed: string[] = [];
  if (!failures.length) {
    const keep = new Set(parsed.data.articles.map((a) => a.page_id));
    for (const e of existing ?? []) {
      if (keep.has(e.page_id)) continue;
      await db.from("notion_chunks").delete().eq("source_id", e.id);
      await db.from("notion_sources").update({ removed_at: new Date().toISOString(), chunk_count: 0 }).eq("id", e.id);
      removed.push(e.title);
    }
  }
  return await finish(failures.length ? "partial" : "success",
    { generated_at: parsed.data.generated_at, articles: parsed.data.articles.length, failures, removed },
    { pages_processed: processed, pages_failed: failures.length, pages_removed: removed.length });
}
