// Read-only Notion helpers (through the Lovable connector gateway) and block → text conversion.
export const ROOT_PAGE_ID = "88e4fd30bc36423cbcf8e3d553dd3888";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";

export class NotionError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  /** Page was deleted, moved out of reach or is no longer shared with the integration. */
  get gone() {
    return this.status === 404 || this.code === "object_not_found";
  }
  /** Credentials missing/revoked: abort the whole run without touching the stored base. */
  get fatal() {
    return this.status === 401 || this.code === "unauthorized" || this.code === "missing_credentials";
  }
}

export function notionClient() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const notionKey = Deno.env.get("NOTION_API_KEY");
  if (!lovableKey || !notionKey) {
    throw new NotionError(401, "missing_credentials", "A conexão com o Notion ainda não foi configurada.");
  }
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": notionKey,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
  };
  let calls = 0;
  async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      calls++;
      const res = await fetch(`${GATEWAY_URL}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const wait = Number(res.headers.get("Retry-After")) || 2 ** attempt;
        await res.body?.cancel();
        await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000 + Math.random() * 300));
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        let code = "error";
        let message = text.slice(0, 300);
        try {
          const j = JSON.parse(text);
          code = j.code ?? j.type ?? code;
          message = j.message ?? message;
        } catch { /* keep raw text */ }
        console.error(`Notion ${init.method ?? "GET"} ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
        throw new NotionError(res.status, code, message);
      }
      return JSON.parse(text);
    }
  }
  /** Lists all children of a block, following pagination. */
  async function children(blockId: string) {
    const all: any[] = [];
    let cursor: string | undefined;
    do {
      const q = `?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`;
      const page = await call(`/blocks/${blockId}/children${q}`);
      all.push(...(page.results ?? []));
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return all;
  }
  return { call, children, get calls() { return calls; } };
}
export type Notion = ReturnType<typeof notionClient>;

export const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t?.plain_text ?? "").join("").trim();

export function pageTitle(page: any): string {
  if (Array.isArray(page?.title)) return plain(page.title) || "Sem título";
  for (const p of Object.values(page?.properties ?? {}) as any[]) {
    if (p?.type === "title") return plain(p.title) || "Sem título";
  }
  return "Sem título";
}

const CONTAINERS = new Set(["column_list", "column", "synced_block", "toggle", "callout", "quote", "bulleted_list_item",
  "numbered_list_item", "to_do", "paragraph", "heading_1", "heading_2", "heading_3", "table"]);
const MEDIA = new Set(["image", "file", "pdf", "video", "audio", "embed", "bookmark", "link_preview", "link_to_page"]);

export interface Unprocessed { type: string; section: string; detail: string }
interface Line { section: string; text: string }

/** Converts a page's blocks into ordered lines tagged with their heading section. Child pages are separate sources. */
export async function readPage(notion: Notion, pageId: string, pageTitleText: string) {
  const lines: Line[] = [];
  const unprocessed: Unprocessed[] = [];
  const headings: string[] = [];
  const section = () => headings.filter(Boolean).join(" › ") || pageTitleText;

  async function walk(blockId: string, depth: number) {
    const blocks = await notion.children(blockId);
    let n = 0;
    for (const b of blocks) {
      const t = b.type as string;
      const v = b[t] ?? {};
      const indent = "  ".repeat(depth);
      if (t !== "numbered_list_item") n = 0;
      let text = "";
      switch (t) {
        case "heading_1": case "heading_2": case "heading_3": {
          const level = Number(t.slice(-1));
          headings.length = level - 1;
          headings[level - 1] = plain(v.rich_text);
          text = `${"#".repeat(level)} ${plain(v.rich_text)}`;
          break;
        }
        case "paragraph": text = plain(v.rich_text); break;
        case "bulleted_list_item": text = `${indent}- ${plain(v.rich_text)}`; break;
        case "numbered_list_item": text = `${indent}${++n}. ${plain(v.rich_text)}`; break;
        case "to_do": text = `${indent}[${v.checked ? "x" : " "}] ${plain(v.rich_text)}`; break;
        case "toggle": text = `${indent}▸ ${plain(v.rich_text)}`; break;
        case "quote": text = `> ${plain(v.rich_text)}`; break;
        case "callout": text = `Destaque: ${plain(v.rich_text)}`; break;
        case "code": text = plain(v.rich_text); break;
        case "equation": text = v.expression ?? ""; break;
        case "table_row": text = (v.cells ?? []).map((c: any[]) => plain(c)).join(" | "); break;
        case "child_page": text = `Subpágina: ${v.title ?? ""}`; break;
        case "child_database": text = `Base de dados: ${v.title ?? ""}`; break;
        case "divider": case "table_of_contents": case "breadcrumb": case "column_list": case "column":
        case "synced_block": case "table": break;
        default:
          if (MEDIA.has(t)) {
            const caption = plain(v.caption);
            const url = v.url ?? v.external?.url ?? "";
            unprocessed.push({ type: t, section: section(), detail: caption || (t === "bookmark" || t === "embed" ? url : "") });
          } else {
            unprocessed.push({ type: t, section: section(), detail: "Tipo de bloco não suportado" });
          }
      }
      if (text.trim()) lines.push({ section: section(), text });
      if (b.has_children && CONTAINERS.has(t) && depth < 5) await walk(b.id, t === "column_list" || t === "column" || t === "table" || t === "synced_block" ? depth : depth + 1);
    }
  }
  await walk(pageId, 0);
  return { lines, unprocessed };
}

/** Groups lines by section into chunks of at most `max` characters. */
export function chunkLines(lines: Line[], max = 1800) {
  const chunks: { section: string; content: string }[] = [];
  let cur: { section: string; content: string } | null = null;
  for (const l of lines) {
    if (!cur || cur.section !== l.section || cur.content.length + l.text.length + 1 > max) {
      if (cur) chunks.push(cur);
      cur = { section: l.section, content: "" };
    }
    cur.content += (cur.content ? "\n" : "") + l.text.slice(0, max);
  }
  if (cur) chunks.push(cur);
  return chunks.filter((c) => c.content.trim());
}
