import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Copy, Eye, GitBranch, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SurveyEditor, { type SurveyKind } from "./SurveyEditor";
import SendSurveyDialog from "./SendSurveyDialog";
import SurveyDetails from "./SurveyDetails";
import { effectiveStatus, formatDateBR, SURVEY_STATUS, type Audience } from "@/lib/research";
import type { Tables } from "@/integrations/supabase/types";

type Survey = Tables<"research_surveys">;
interface Props { audience: Audience; can: (p: "surveys_edit" | "surveys_send" | "responses_identified" | "lists_import") => boolean; }
const KIND: Record<string, string> = { nps: "NPS", csat: "CSAT", custom: "Personalizada" };

export default function SurveysTab({ audience, can }: Props) {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ id: string | null; kind: SurveyKind } | null>(null);
  const [sending, setSending] = useState<Survey | null>(null);
  const [details, setDetails] = useState<Survey | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const surveys = useQuery({
    queryKey: ["research-surveys", audience],
    queryFn: async () => { const { data, error } = await supabase.from("research_surveys").select("*").eq("audience", audience).order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["research-surveys"] }); qc.invalidateQueries({ queryKey: ["research-dashboard"] }); };
  const duplicate = async (s: Survey, asVersion: boolean) => {
    const { data, error } = await supabase.rpc("research_duplicate_survey", { _id: s.id, _new_version: asVersion });
    if (error) { toast.error(error.message); return; }
    toast.success(asVersion ? "Nova versão criada como rascunho." : "Cópia criada como rascunho.");
    refresh(); setEditor({ id: data as string, kind: s.kind as SurveyKind });
  };
  const remove = async (s: Survey) => {
    if (!window.confirm(`Excluir o rascunho "${s.title}"?`)) return;
    const { error } = await supabase.from("research_surveys").delete().eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Rascunho excluído."); refresh(); }
  };

  const list = (surveys.data ?? []).filter((s) => s.title.toLowerCase().includes(search.toLowerCase()) && (status === "all" || effectiveStatus(s.status, s.deadline_at) === status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-w-40 flex-1" placeholder="Buscar pesquisa" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar pesquisa" />
        <select aria-label="Filtrar status" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos os status</option>{Object.entries(SURVEY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {can("surveys_edit") && <>
          <Button onClick={() => setEditor({ id: null, kind: "nps" })}><Plus />Modelo NPS</Button>
          <Button variant="outline" onClick={() => setEditor({ id: null, kind: "csat" })}><Plus />Modelo CSAT</Button>
          <Button variant="outline" onClick={() => setEditor({ id: null, kind: "custom" })}><Plus />Personalizada</Button>
        </>}
      </div>
      {surveys.isLoading ? <p role="status">Carregando pesquisas…</p> : surveys.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as pesquisas.</p> : !list.length ? (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center"><ClipboardList className="h-10 w-10 text-primary" /><p className="font-semibold">Nenhuma pesquisa encontrada</p><p className="text-sm text-muted-foreground">Comece por um modelo NPS ou CSAT, ou crie uma pesquisa personalizada.</p></div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((s) => {
            const st = effectiveStatus(s.status, s.deadline_at);
            return (
              <article key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={st === "active" ? "default" : "secondary"}>{s.published_at && st==="draft" ? "Publicada · aguardando envio" : SURVEY_STATUS[st]}</Badge><Badge variant="outline">{KIND[s.kind]}</Badge><Badge variant="outline">{s.anonymous ? "Anônima" : "Identificada"}</Badge>{s.version > 1 && <Badge variant="outline">v{s.version}</Badge>}</div>
                <div><h3 className="font-semibold break-words">{s.title}</h3><p className="text-xs text-muted-foreground">{[s.training_name, s.class_name && `Turma ${s.class_name}`].filter(Boolean).join(" · ") || (s.standalone_reason ? `Avulsa: ${s.standalone_reason}` : "Sem vínculo")}</p></div>
                <p className="text-xs text-muted-foreground">{s.first_sent_at ? `Enviada em ${formatDateBR(s.first_sent_at)} · prazo ${formatDateBR(s.deadline_at)}` : `Criada em ${formatDateBR(s.created_at)}`}</p>
                <div className="mt-auto flex flex-wrap gap-1">
                  {can("surveys_edit") && <Button size="sm" variant="outline" onClick={() => setEditor({ id: s.id, kind: s.kind as SurveyKind })}><Pencil />Editar</Button>}
                  {can("surveys_send") && st !== "closed" && <Button size="sm" onClick={() => setSending(s)}><Send />Enviar</Button>}
                  <Button size="sm" variant="outline" onClick={() => setDetails(s)}><Eye />Detalhes</Button>
                  {can("surveys_edit") && <Button size="icon" variant="ghost" title="Duplicar" aria-label="Duplicar" onClick={() => duplicate(s, false)}><Copy /></Button>}
                  {can("surveys_edit") && (s.first_sent_at || s.published_at) && <Button size="icon" variant="ghost" title="Criar nova versão" aria-label="Criar nova versão" onClick={() => duplicate(s, true)}><GitBranch /></Button>}
                  {can("surveys_edit") && !s.first_sent_at && <Button size="icon" variant="ghost" title="Excluir rascunho" aria-label="Excluir rascunho" onClick={() => remove(s)}><Trash2 /></Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editor && <SurveyEditor open audience={audience} surveyId={editor.id} kind={editor.kind} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh(); }} onNewVersion={(id) => { const s = surveys.data?.find((x) => x.id === id); if (s) { setEditor(null); duplicate(s, true); } }} />}
      <SendSurveyDialog survey={sending} canImport={can("lists_import")} onClose={() => setSending(null)} onSent={refresh} />
      <SurveyDetails survey={details} canSend={can("surveys_send")} canSeeIdentified={can("responses_identified")} onClose={() => setDetails(null)} onChanged={() => { refresh(); surveys.refetch().then((r) => setDetails((d) => r.data?.find((x) => x.id === d?.id) ?? d)); }} />
    </div>
  );
}
