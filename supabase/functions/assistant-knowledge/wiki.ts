// Read-only client for the Nexti Wiki (Outline, https://wiki.shared.nexti.com) API.
export const WIKI_URL = "https://wiki.shared.nexti.com";

export class WikiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  /** Document deleted or no longer visible to the integration. */
  get gone() { return this.status === 404 || this.code === "not_found"; }
  /** Key missing, revoked or without permission: abort the run and keep the stored base. */
  get fatal() { return this.status === 401 || this.code === "authentication_required" || this.code === "missing_credentials"; }
}

export function wikiClient() {
  const key = Deno.env.get("WIKI_API_KEY");
  if (!key) throw new WikiError(401, "missing_credentials", "A chave de acesso do Wiki ainda não foi configurada.");
  let calls = 0;
  async function call(method: string, body: Record<string, unknown> = {}): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      calls++;
      const res = await fetch(`${WIKI_URL}/api/${method}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const wait = Number(res.headers.get("Retry-After")) || 2 ** attempt;
        await res.body?.cancel();
        await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000 + Math.random() * 300));
        continue;
      }
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      if (!res.ok || json?.ok === false) {
        console.error(`Wiki ${method} failed [${res.status}]: ${text.slice(0, 500)}`);
        const code = json?.error ?? "error";
        const message = res.status === 401 ? "O Wiki recusou a chave de acesso (inválida ou revogada)."
          : res.status === 403 ? "A chave do Wiki não tem permissão para esta leitura."
          : json?.message ?? text.slice(0, 300);
        throw new WikiError(res.status, code, message);
      }
      return json;
    }
  }
  /** Follows Outline offset pagination. */
  async function all(method: string, body: Record<string, unknown> = {}, cap = 5000) {
    const out: any[] = [];
    for (let offset = 0; out.length < cap; offset += 100) {
      const page = await call(method, { ...body, limit: 100, offset });
      const data = page.data ?? [];
      out.push(...data);
      if (data.length < 100) break;
    }
    return out;
  }
  return { call, all, get calls() { return calls; } };
}
export type Wiki = ReturnType<typeof wikiClient>;
