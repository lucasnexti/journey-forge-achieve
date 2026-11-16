// Admin-only: inventories the Notion pages under the root page and syncs approved pages into the assistant base.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { chunkLines, NotionError, notionClient, pageTitle, readPage, ROOT_PAGE_ID, type Notion } from "./notion.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ action: z.enum(["status", "inventory", "sync", "import_octadesk"]) });
const MAX_PAGES = 300;
const TIME_BUDGET_MS = 115_000;
const norm = (id: string) => id.replace(/-/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Faça login para continuar." }, 401);
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Somente administradores." }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { action } = parsed.data;
  if (action === "import_octadesk") return await importOctadesk(db, userData.user.id);

  let notion: Notion;
  try {
    notion = notionClient();
  } catch (e) {
    if (action === "status") return json({ connected: false, message: (e as Error).message });
    return await failRun(db, action === "sync" ? "sync" : "inventory", userData.user.id, (e as Error).message);
  }

  if (action === "status") {
    try {
      const me = await notion.call("/users/me");
      const root = await notion.call(`/pages/${ROOT_PAGE_ID}`).then((p) => ({ ok: true, title: pageTitle(p), url: p.url }))
        .catch((e: NotionError) => ({ ok: false, title: null, url: null, error: e.gone ? "A página inicial não foi compartilhada com a integração." : e.message }));
      return json({ connected: true, bot: me?.name ?? null, root });
    } catch (e) {
      return json({ connected: false, message: (e as Error).message, status: (e as NotionError).status ?? null });
    }
  }
  return action === "inventory"
    ? await inventory(db, notion, userData.user.id)
    : await sync(db, notion, userData.user.id);
});

async function failRun(db: SupabaseClient, kind: "inventory" | "sync", userId: string, message: string) {
  await db.from("notion_sync_runs").insert({
    kind, status: "failed", started_by: userId, finished_at: new Date().toISOString(), details: { error: message },
  });
  return json({ status: "failed", error: message }, 200);
}

interface Found { page_id: string; parent_page_id: string | null; kind: "page" | "database"; title: string; url: string | null;
  depth: number; position: number; notion_last_edited: string | null }

async function inventory(db: SupabaseClient, notion: Notion, userId: string) {
  const started = Date.now();
  const { data: run } = await db.from("notion_sync_runs").insert({ kind: "inventory", started_by: userId }).select("id").single();
  const found = new Map<string, Found>();
  const failures: { page: string; error: string }[] = [];
  let incomplete = false;
  let position = 0;
  const queue: { id: string; kind: "page" | "database"; parent: string | null; depth: number }[] = [
    { id: ROOT_PAGE_ID, kind: "page", parent: null, depth: 0 },
  ];

  async function findChildren(blockId: string, parent: string, depth: number, nest: number) {
    for (const b of await notion.children(blockId)) {
      if (b.type === "child_page") queue.push({ id: norm(b.id), kind: "page", parent, depth: depth + 1 });
      else if (b.type === "child_database") queue.push({ id: norm(b.id), kind: "database", parent, depth: depth + 1 });
      else if (b.has_children && nest < 3 && ["column_list", "column", "toggle", "synced_block", "callout"].includes(b.type))
        await findChildren(b.id, parent, depth, nest + 1);
    }
  }

  try {
    while (queue.length) {
      if (found.size >= MAX_PAGES || Date.now() - started > TIME_BUDGET_MS) { incomplete = true; break; }
      const node = queue.shift()!;
      if (found.has(node.id)) continue;
      try {
        if (node.kind === "page") {
          const p = await notion.call(`/pages/${node.id}`);
          if (p.in_trash || p.archived) continue;
          found.set(node.id, { page_id: node.id, parent_page_id: node.parent, kind: "page", title: pageTitle(p), url: p.url ?? null,
            depth: node.depth, position: position++, notion_last_edited: p.last_edited_time ?? null });
          await findChildren(node.id, node.id, node.depth, 0);
        } else {
          const d = await notion.call(`/databases/${node.id}`);
          if (d.in_trash || d.archived) continue;
          found.set(node.id, { page_id: node.id, parent_page_id: node.parent, kind: "database", title: pageTitle(d), url: d.url ?? null,
            depth: node.depth, position: position++, notion_last_edited: d.last_edited_time ?? null });
          for (const ds of d.data_sources ?? []) {
            let cursor: string | undefined;
            let rows = 0;
            do {
              const page = await notion.call(`/data_sources/${ds.id}/query`, { method: "POST",
                body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } });
              for (const r of page.results ?? []) {
                if (r.object === "page") queue.push({ id: norm(r.id), kind: "page", parent: node.id, depth: node.depth + 1 });
              }
              rows += page.results?.length ?? 0;
              cursor = page.has_more && rows < 200 ? page.next_cursor : undefined;
            } while (cursor);
          }
        }
      } catch (e) {
        const err = e as NotionError;
        if (err.fatal) throw err;
        if (node.id === ROOT_PAGE_ID) throw new NotionError(err.status, err.code,
          err.gone ? "A página “Bem-Vindo à Nexti” não está compartilhada com a integração do Notion." : err.message);
        failures.push({ page: node.id, error: err.message });
        incomplete = true; // a branch we could not read must not be treated as removed
      }
    }
  } catch (e) {
    const message = (e as Error).message;
    await db.from("notion_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(),
      details: { error: message } }).eq("id", run?.id);
    return json({ status: "failed", error: message });
  }

  const rows = [...found.values()].map((f) => ({ ...f, removed_at: null }));
  const { error: upErr } = rows.length ? await db.from("notion_sources").upsert(rows, { onConflict: "page_id" }) : { error: null };
  if (upErr) {
    await db.from("notion_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(),
      details: { error: upErr.message } }).eq("id", run?.id);
    return json({ status: "failed", error: upErr.message });
  }

  // Only a complete inventory may conclude that a page left the shared tree.
  const removed: string[] = [];
  if (!incomplete) {
    const { data: existing } = await db.from("notion_sources").select("id,page_id,title").eq("provider", "notion").is("removed_at", null);
    for (const s of existing ?? []) {
      if (found.has(s.page_id)) continue;
      await db.from("notion_chunks").delete().eq("source_id", s.id);
      await db.from("notion_sources").update({ removed_at: new Date().toISOString(), chunk_count: 0 }).eq("id", s.id);
      removed.push(s.title);
    }
  }
  const status = failures.length || incomplete ? "partial" : "success";
  const details = { found: found.size, failures, removed, incomplete, notion_calls: notion.calls };
  await db.from("notion_sync_runs").update({ status, finished_at: new Date().toISOString(), pages_processed: found.size,
    pages_failed: failures.length, pages_removed: removed.length, details }).eq("id", run?.id);
  return json({ status, ...details });
}

async function sync(db: SupabaseClient, notion: Notion, userId: string) {
  const started = Date.now();
  const { data: run } = await db.from("notion_sync_runs").insert({ kind: "sync", started_by: userId }).select("id").single();
  const { data: sources, error } = await db.from("notion_sources")
    .select("id,page_id,kind,title,status,removed_at,chunk_count,synced_edited_time").eq("provider", "notion").order("position");
  if (error) return await finish("failed", { error: error.message });

  const failures: { title: string; error: string }[] = [];
  const removed: string[] = [];
  const deauthorized: string[] = [];
  const pending: string[] = [];
  const processed: string[] = [];
  let unchanged = 0;
  let unprocessedCount = 0;

  async function finish(status: string, details: Record<string, unknown>) {
    await db.from("notion_sync_runs").update({ status, finished_at: new Date().toISOString(), pages_processed: processed.length,
      pages_unchanged: unchanged, pages_failed: failures.length, pages_removed: removed.length + deauthorized.length, details })
      .eq("id", run?.id);
    return json({ status, ...details, processed: processed.length, unchanged });
  }

  // Pages that are no longer approved (or left Notion) leave the answer base.
  for (const s of sources ?? []) {
    if ((s.status !== "approved" || s.removed_at) && s.chunk_count > 0) {
      await db.from("notion_chunks").delete().eq("source_id", s.id);
      await db.from("notion_sources").update({ chunk_count: 0 }).eq("id", s.id);
      deauthorized.push(s.title);
    }
  }

  const approved = (sources ?? []).filter((s) => s.status === "approved" && !s.removed_at && s.kind === "page");
  for (const s of approved) {
    if (Date.now() - started > TIME_BUDGET_MS) { pending.push(s.title); continue; }
    try {
      const p = await notion.call(`/pages/${s.page_id}`);
      if (p.in_trash || p.archived) throw new NotionError(404, "object_not_found", "Página arquivada no Notion");
      const title = pageTitle(p);
      const edited = p.last_edited_time ?? null;
      if (edited && s.synced_edited_time && new Date(edited).getTime() === new Date(s.synced_edited_time).getTime() && s.chunk_count > 0) {
        unchanged++;
        continue;
      }
      const { lines, unprocessed } = await readPage(notion, s.page_id, title);
      unprocessedCount += unprocessed.length;
      const chunks = chunkLines(lines).map((c, i) => ({ ...c, page_id: s.page_id, page_title: title, url: p.url ?? null,
        page_updated_at: edited, position: i }));
      const { error: repErr } = await db.rpc("replace_notion_chunks", { _source_id: s.id, _chunks: chunks, _edited: edited,
        _unprocessed: unprocessed });
      if (repErr) throw new Error(repErr.message);
      await db.from("notion_sources").update({ title, url: p.url ?? null, notion_last_edited: edited }).eq("id", s.id);
      processed.push(title);
    } catch (e) {
      const err = e as NotionError;
      if (err.fatal) {
        return await finish("failed", { error: "Não foi possível acessar o Notion. A base anterior foi mantida.", detail: err.message,
          failures, removed, deauthorized });
      }
      if (err.gone) {
        await db.from("notion_chunks").delete().eq("source_id", s.id);
        await db.from("notion_sources").update({ removed_at: new Date().toISOString(), chunk_count: 0 }).eq("id", s.id);
        removed.push(s.title);
        continue;
      }
      failures.push({ title: s.title, error: err.message });
      await db.from("notion_sources").update({ sync_error: err.message.slice(0, 500) }).eq("id", s.id);
    }
  }
  const attempted = approved.length - pending.length;
  const status = approved.length === 0 ? "success"
    : failures.length && failures.length === attempted ? "failed"
    : failures.length || pending.length ? "partial" : "success";
  return await finish(status, { approved: approved.length, failures, removed, deauthorized, pending,
    unprocessed: unprocessedCount, titles: processed });
}

// Octadesk public knowledge base: the prepared index (text read from each article's PDF plus the Nexti na Prática
// orientations made from it) lives in the private assistant-knowledge bucket. New articles start approved for
// customers; an admin's later review (status, audience, module) is kept on re-import.
const OctaChunk = z.object({
  section: z.string().max(300), content: z.string().min(1).max(4000),
  orientation_path: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/).nullable(), orientation_title: z.string().max(300).nullable(),
});
const OctaIndex = z.object({
  source: z.literal("https://nexti.octadesk.com/kb/"), generated_at: z.string(),
  articles: z.array(z.object({
    page_id: z.string().regex(/^octadesk:[a-z0-9-]+$/), title: z.string().min(1).max(300),
    url: z.string().startsWith("https://nexti.octadesk.com/kb/article/"), module: z.enum(["nexti", "talent", "admissao"]),
    position: z.number().int(), linked_orientation_path: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/).nullable(),
    linked_orientation_title: z.string().nullable(), unprocessed: z.array(z.any()).max(20), chunks: z.array(OctaChunk).max(400),
  })).min(1).max(500),
});

async function importOctadesk(db: SupabaseClient, userId: string) {
  const { data: run } = await db.from("notion_sync_runs").insert({ kind: "octadesk", started_by: userId }).select("id").single();
  const finish = async (status: string, details: Record<string, unknown>, counts: Record<string, number> = {}) => {
    await db.from("notion_sync_runs").update({ status, finished_at: new Date().toISOString(), details, ...counts }).eq("id", run?.id);
    return json({ status, ...details });
  };
  const { data: file, error: dlErr } = await db.storage.from("assistant-knowledge").download("octadesk/index.json");
  if (dlErr || !file) return await finish("failed", { error: "Arquivo da base Octadesk não encontrado." });
  const parsed = OctaIndex.safeParse(JSON.parse(await file.text()));
  if (!parsed.success) return await finish("failed", { error: "Arquivo da base Octadesk inválido." });

  const { data: existing } = await db.from("notion_sources").select("id,page_id,title").eq("provider", "octadesk");
  const byPage = new Map((existing ?? []).map((e) => [e.page_id, e]));
  const failures: { title: string; error: string }[] = [];
  let processed = 0;
  for (const a of parsed.data.articles) {
    const base = { title: a.title, url: a.url, position: 100000 + a.position, removed_at: null,
      linked_orientation_path: a.linked_orientation_path, linked_orientation_title: a.linked_orientation_title };
    let id = byPage.get(a.page_id)?.id;
    if (id) {
      const { error } = await db.from("notion_sources").update(base).eq("id", id);
      if (error) { failures.push({ title: a.title, error: error.message }); continue; }
    } else {
      const { data, error } = await db.from("notion_sources").insert({ ...base, provider: "octadesk", page_id: a.page_id,
        status: "approved", audience: "clientes", module: a.module }).select("id").single();
      if (error || !data) { failures.push({ title: a.title, error: error?.message ?? "falha ao criar" }); continue; }
      id = data.id;
    }
    const chunks = a.chunks.map((c, i) => ({ ...c, page_id: a.page_id, page_title: a.title, url: a.url, position: i }));
    const { error } = await db.rpc("replace_notion_chunks", { _source_id: id, _chunks: chunks, _edited: null, _unprocessed: a.unprocessed });
    if (error) failures.push({ title: a.title, error: error.message }); else processed++;
  }
  // Articles that left the Octadesk base leave the answers (only when the whole import worked).
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
