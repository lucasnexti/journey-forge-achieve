import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, ListTree, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { KB_ID } from "@/lib/nextiNaPraticaBridge";

type Source = {
  id: string; page_id: string; parent_page_id: string | null; kind: string; title: string; url: string | null; depth: number;
  position: number; notion_last_edited: string | null; status: string; audience: string; module: string | null;
  linked_orientation_path: string | null; linked_orientation_title: string | null; removed_at: string | null;
  last_synced_at: string | null; sync_error: string | null; unprocessed: { type: string; section: string; detail: string }[];
  chunk_count: number; provider: string;
};
type Run = {
  id: string; kind: string; status: string; started_at: string; finished_at: string | null; pages_processed: number;
  pages_unchanged: number; pages_failed: number; pages_removed: number; details: Record<string, any>;
};
type Ori = { path: string; title: string };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const STATUS: Record<string, string> = { pending: "Pendente", approved: "Aprovada", excluded: "Excluída" };
const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  success: { label: "Concluída", cls: "bg-success/10 text-success" },
  partial: { label: "Concluída com pendências", cls: "bg-warning/10 text-warning" },
  failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive" },
  running: { label: "Em andamento", cls: "bg-muted text-muted-foreground" },
};
const UNPROCESSED: Record<string, string> = {
  image: "Imagem", file: "Arquivo", pdf: "PDF", video: "Vídeo", audio: "Áudio", embed: "Conteúdo incorporado",
  bookmark: "Link", link_preview: "Link", link_to_page: "Link para página",
};

async function callNotion(action: "status" | "inventory" | "sync") {
  const { data, error } = await supabase.functions.invoke("notion-knowledge", { body: { action } });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details).error ?? details; } catch { /* raw */ }
    throw new Error(typeof msg === "string" ? msg : "Falha ao acessar o Notion");
  }
  return data as any;
}

export default function AdminAssistenteIA() {
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [oris, setOris] = useState<Ori[]>([]);
  const [conn, setConn] = useState<any>(null);
  const [busy, setBusy] = useState<null | "inventory" | "sync">(null);
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState<"all" | "notion" | "octadesk">("all");
  const [feedback, setFeedback] = useState({ yes: 0, no: 0 });

  const load = async () => {
    const [s, r, f] = await Promise.all([
      supabase.from("notion_sources").select("*").order("position"),
      supabase.from("notion_sync_runs").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("ai_assistant_feedback").select("helpful"),
    ]);
    setSources((s.data as unknown as Source[]) ?? []);
    setRuns((r.data as unknown as Run[]) ?? []);
    const rows = (f.data ?? []) as { helpful: boolean }[];
    setFeedback({ yes: rows.filter((x) => x.helpful).length, no: rows.filter((x) => !x.helpful).length });
  };

  useEffect(() => {
    load();
    callNotion("status").then(setConn).catch((e) => setConn({ connected: false, message: e.message }));
    supabase.rpc("get_knowledge_base", { _id: KB_ID }).then(({ data }) => {
      const d = (data as any)?.dados;
      const list: Ori[] = (d?.orientacoes ?? [])
        .filter((o: any) => o.slug && o.modulo && o.submodulos?.[0])
        .map((o: any) => ({ path: `${o.modulo}/${o.submodulos[0]}/${o.slug}`, title: o.titulo }));
      setOris(list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR")));
    });
  }, []);

  const run = async (action: "inventory" | "sync") => {
    setBusy(action);
    try {
      const r = await callNotion(action);
      if (r.status === "failed") toast.error(r.error ?? "A sincronização falhou. A base anterior foi mantida.");
      else if (r.status === "partial") toast.warning("Concluída com pendências. Veja os detalhes abaixo.");
      else toast.success(action === "inventory" ? `Lista atualizada: ${r.found} páginas encontradas.` : "Base sincronizada com o Notion.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      load();
    }
  };

  const update = async (s: Source, patch: Partial<Source>) => {
    const { error } = await supabase.from("notion_sources").update(patch as any).eq("id", s.id);
    if (error) return toast.error(error.message);
    setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    if (s.provider === "octadesk") toast.success("Alteração salva e já aplicada às respostas.");
    else if ("status" in patch || "audience" in patch || "module" in patch)
      toast.info("Alteração salva. Clique em “Sincronizar com Notion” para aplicá-la às respostas.");
  };

  const lastSync = runs.find((r) => r.kind === "sync" && r.status === "success");
  const lastOcta = runs.find((r) => r.kind === "octadesk" && r.status !== "running");
  const lastRun = runs.find((r) => r.kind !== "octadesk");
  const approved = sources.filter((s) => s.status === "approved" && !s.removed_at);
  const answering = approved.filter((s) => s.chunk_count > 0);
  const unprocessed = sources.filter((s) => s.status === "approved" && s.unprocessed?.length);
  const filtered = useMemo(
    () => sources.filter((s) => (origin === "all" || s.provider === origin) && (!q || s.title.toLowerCase().includes(q.toLowerCase()))),
    [sources, q, origin],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assistente de dúvidas (IA)</h1>
          <p className="text-sm text-muted-foreground">
            Escolha quais páginas do Notion e artigos da Base de Conhecimento Nexti (Octadesk) o “Assistente dos manuais” pode usar no Nexti na Prática. Só materiais aprovados alimentam as respostas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Conexão com o Notion</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {!conn ? (
                <span className="text-muted-foreground">Verificando…</span>
              ) : conn.connected ? (
                <>
                  <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> Conectado (somente leitura)</p>
                  {conn.root?.ok ? (
                    <p className="text-muted-foreground">Página inicial: {conn.root.title}</p>
                  ) : (
                    <p className="text-destructive">{conn.root?.error}</p>
                  )}
                </>
              ) : (
                <p className="flex items-start gap-1.5 text-destructive"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {conn.message ?? "Não conectado"}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Base de respostas</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>{answering.length}</strong> de {approved.length} materiais aprovados com conteúdo</p>
              <p className="text-muted-foreground">
                Octadesk: {sources.filter((s) => s.provider === "octadesk" && s.status === "approved" && s.chunk_count > 0).length} artigos · importado em {fmt(lastOcta?.finished_at ?? null)}
              </p>
              <p className="text-muted-foreground">Notion: última sincronização {fmt(lastSync?.finished_at ?? null)}</p>
              <p className="text-muted-foreground">Avaliações: {feedback.yes} “Sim” · {feedback.no} “Não”</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ações</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" disabled={!!busy || conn?.connected === false} onClick={() => run("inventory")}>
                {busy === "inventory" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTree className="h-4 w-4" />}
                Atualizar lista de páginas
              </Button>
              <Button disabled={!!busy || conn?.connected === false} onClick={() => run("sync")}>
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar com Notion
              </Button>
            </CardContent>
          </Card>
        </div>

        {lastRun && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                Última execução: {lastRun.kind === "sync" ? "sincronização" : "atualização da lista"} em {fmt(lastRun.started_at)}
                <Badge className={RUN_STATUS[lastRun.status]?.cls}>{RUN_STATUS[lastRun.status]?.label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lastRun.kind === "sync" ? (
                <p>Páginas processadas: {lastRun.pages_processed} · sem alteração: {lastRun.pages_unchanged} · falhas: {lastRun.pages_failed} · retiradas da base: {lastRun.pages_removed}</p>
              ) : (
                <p>Páginas encontradas: {lastRun.pages_processed} · falhas: {lastRun.pages_failed} · removidas do Notion: {lastRun.pages_removed}</p>
              )}
              {lastRun.details?.error && <p className="text-destructive">{lastRun.details.error}</p>}
              {lastRun.details?.incomplete && <p className="text-warning">A lista ficou incompleta; nenhuma página foi considerada removida.</p>}
              {(lastRun.details?.failures ?? []).map((f: any, i: number) => (
                <p key={i} className="flex gap-1.5 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{f.title ?? f.page}: {f.error}</p>
              ))}
              {(lastRun.details?.pending ?? []).length > 0 && (
                <p className="text-warning">Ficaram para a próxima sincronização: {lastRun.details.pending.join(", ")}</p>
              )}
              {[...(lastRun.details?.removed ?? []), ...(lastRun.details?.deauthorized ?? [])].length > 0 && (
                <p className="text-muted-foreground">Retiradas das respostas: {[...(lastRun.details?.removed ?? []), ...(lastRun.details?.deauthorized ?? [])].join(", ")}</p>
              )}
            </CardContent>
          </Card>
        )}

        {unprocessed.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Materiais não processados</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Imagens, arquivos, links e páginas de PDF que são só imagem não têm o conteúdo lido; o assistente não responde com base neles.</p>
              {unprocessed.some((s) => s.provider === "octadesk") && (
                <details>
                  <summary className="cursor-pointer text-foreground">
                    Octadesk: {unprocessed.filter((s) => s.provider === "octadesk").length} artigos têm páginas só com imagem (não lidas)
                  </summary>
                  <div className="mt-1 space-y-0.5 pl-4">
                    {unprocessed.filter((s) => s.provider === "octadesk").map((s) => (
                      <p key={s.id}><span className="font-medium text-foreground">{s.title}:</span> {s.unprocessed.map((u) => u.detail).join("; ")}</p>
                    ))}
                  </div>
                </details>
              )}
              {unprocessed.filter((s) => s.provider !== "octadesk").map((s) => (
                <p key={s.id}>
                  <span className="font-medium text-foreground">{s.title}:</span>{" "}
                  {Object.entries(s.unprocessed.reduce<Record<string, number>>((acc, u) => {
                    const k = UNPROCESSED[u.type] ?? u.type; acc[k] = (acc[k] ?? 0) + 1; return acc;
                  }, {})).map(([k, n]) => `${n} ${k.toLowerCase()}${n > 1 ? "s" : ""}`).join(", ")}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm">Materiais ({filtered.length})</CardTitle>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Select value={origin} onValueChange={(v) => setOrigin(v as typeof origin)}>
              <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="notion">Notion</SelectItem>
                <SelectItem value="octadesk">Octadesk</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar material" className="pl-8" />
            </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {sources.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma página listada ainda. Conecte o Notion e clique em “Atualizar lista de páginas”.
              </p>
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2">Material</th>
                    <th className="py-2 pr-2">Situação</th>
                    <th className="py-2 pr-2">Público</th>
                    <th className="py-2 pr-2">Módulo</th>
                    <th className="py-2 pr-2">Orientação equivalente</th>
                    <th className="py-2">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b align-top last:border-0">
                      <td className="py-2 pr-2">
                        <div style={{ paddingLeft: Math.min(s.depth, 6) * 14 }} className="flex items-start gap-1">
                          <div className="min-w-0">
                            <p className="font-medium">
                              <Badge variant="outline" className="mr-1.5 px-1.5 py-0 text-[10px] font-normal">{s.provider === "octadesk" ? "Octadesk" : "Notion"}</Badge>
                              {s.title}{s.kind === "database" && <span className="ml-1 text-xs text-muted-foreground">(base de dados)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.provider === "octadesk" ? `Importado ${fmt(s.last_synced_at)}` : `Editada ${fmt(s.notion_last_edited)}`}
                              {s.url && (<> · <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">abrir <ExternalLink className="h-3 w-3" /></a></>)}
                            </p>
                            {s.removed_at && <Badge variant="outline" className="mt-1 text-destructive">Não encontrada no Notion</Badge>}
                            {s.sync_error && <p className="mt-1 text-xs text-destructive">{s.sync_error}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <Select value={s.status} onValueChange={(v) => update(s, { status: v })} disabled={s.kind === "database"}>
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Select value={s.audience} onValueChange={(v) => update(s, { audience: v })}>
                          <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clientes">Clientes</SelectItem>
                            <SelectItem value="admins">Só admins</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Select value={s.module ?? "geral"} onValueChange={(v) => update(s, { module: v === "geral" ? null : v })}>
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geral">Todos</SelectItem>
                            <SelectItem value="nexti">Nexti</SelectItem>
                            <SelectItem value="talent">Talent</SelectItem>
                            <SelectItem value="admissao">Admissão</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Select
                          value={s.linked_orientation_path ?? "none"}
                          onValueChange={(v) => {
                            const o = oris.find((x) => x.path === v);
                            update(s, { linked_orientation_path: o?.path ?? null, linked_orientation_title: o?.title ?? null });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {oris.map((o) => <SelectItem key={o.path} value={o.path}>{o.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {s.chunk_count > 0 ? `${s.chunk_count} trechos · ${fmt(s.last_synced_at)}` : s.status === "approved" ? "Aguardando sincronização" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
