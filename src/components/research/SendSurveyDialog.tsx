import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Upload, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ImportListWizard from "./ImportListWizard";
import { audienceLabel, deadlineDate, fillEmail, formatDateBR, formatDateTimeBR, type Audience } from "@/lib/research";
import type { Tables } from "@/integrations/supabase/types";

type Survey = Tables<"research_surveys">;
interface Props { survey: Survey | null; canImport: boolean; onClose: () => void; onSent: () => void; }
interface Preview { unique_recipients: number; already_invited: number; new_recipients: number; audience_match: boolean; list_summary: Record<string, number>; sender: { email: string; name: string } | null; deadline_at: string | null; status: string; }

export default function SendSurveyDialog({ survey, canImport, onClose, onSent }: Props) {
  const open = !!survey;
  const audience = (survey?.audience ?? "interno") as Audience;
  const [listId, setListId] = useState("");
  const [importing, setImporting] = useState(false);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [reminderOn, setReminderOn] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped_existing: number; dispatch?: { sent: number; blocked: number; retry: number; failed: number } | null; dispatchError?: string } | null>(null);
  const firstSend = !survey?.first_sent_at;

  useEffect(() => {
    if (survey) { setListId(""); setResult(null); setDeadlineDays(survey.deadline_days); setReminderOn(survey.reminder_enabled); setReminderDays(survey.reminder_after_days); }
  }, [survey?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = useQuery({
    queryKey: ["research-lists", audience], enabled: open,
    queryFn: async () => { const { data, error } = await supabase.from("research_lists").select("*").eq("audience", audience).order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const preview = useQuery({
    queryKey: ["research-send-preview", survey?.id, listId], enabled: open && !!listId,
    queryFn: async () => { const { data, error } = await supabase.rpc("research_send_preview", { _survey: survey!.id, _list: listId }); if (error) throw error; return data as unknown as Preview; },
  });
  const p = preview.data;
  const excluded = p ? (p.list_summary.invalid ?? 0) + (p.list_summary.no_email ?? 0) + (p.list_summary.duplicates ?? 0) + (p.list_summary.excluded ?? 0) + (p.list_summary.server_rejected ?? 0) + (p.list_summary.server_duplicates ?? 0) : 0;
  const prazo = firstSend ? formatDateBR(deadlineDate(deadlineDays)) : formatDateTimeBR(survey?.deadline_at);
  const vars = { nome: "Maria", pesquisa: survey?.title ?? "", link: "(link individual)", prazo };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-email-dispatch", { body: { action: "test", survey_id: survey!.id } });
      if (error) throw error;
      if (data.outcome === "sent") toast.success("E-mail de teste enviado para você.");
      else toast.warning(`Teste não enviado: ${data.error}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar o teste."); } finally { setBusy(false); }
  };

  const send = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("research_send_survey", { _survey: survey!.id, _list: listId, _deadline_days: deadlineDays, _reminder_enabled: reminderOn, _reminder_after_days: reminderDays });
      if (error) throw error;
      const r = data as { created: number; skipped_existing: number };
      let dispatch = null; let dispatchError: string | undefined;
      if (r.created > 0) {
        const d = await supabase.functions.invoke("research-email-dispatch", { body: { action: "process" } });
        if (d.error) dispatchError = "Os convites foram criados e ficaram na fila; o processamento será retomado automaticamente.";
        else dispatch = d.data;
      }
      setResult({ ...r, dispatch, dispatchError });
      onSent();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar."); } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open && !importing} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar pesquisa</DialogTitle>
            <DialogDescription>{survey?.title} · {audienceLabel(audience)}</DialogDescription>
          </DialogHeader>
          {result ? (
            <div className="space-y-3">
              <p className="text-base font-semibold">{result.created} convites individuais criados.</p>
              {result.skipped_existing > 0 && <p className="text-sm text-muted-foreground">{result.skipped_existing} pessoas já tinham convite desta pesquisa e não receberão outro.</p>}
              {result.dispatch && (
                <ul className="space-y-1 text-sm">
                  <li>Enviados ao serviço de e-mail: <strong>{result.dispatch.sent}</strong></li>
                  {result.dispatch.blocked > 0 && <li className="text-destructive">Aguardando configuração do e-mail: <strong>{result.dispatch.blocked}</strong> — nada foi disparado. Veja Configurações.</li>}
                  {result.dispatch.retry > 0 && <li>Nova tentativa agendada: {result.dispatch.retry}</li>}
                  {result.dispatch.failed > 0 && <li className="text-destructive">Falhas: {result.dispatch.failed}</li>}
                </ul>
              )}
              {result.dispatchError && <p className="text-sm text-muted-foreground">{result.dispatchError}</p>}
              <div className="flex justify-end"><Button onClick={onClose}>Fechar</Button></div>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">1. Lista de destinatários</h3>
                <div className="flex flex-wrap gap-2">
                  <select aria-label="Lista" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={listId} onChange={(e) => setListId(e.target.value)}>
                    <option value="">Selecione uma lista de {audienceLabel(audience)}</option>
                    {(lists.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} · {l.purpose === "attendance" ? "Presença" : "Destinatários"} · {l.member_count} pessoas{l.training_date ? ` · ${formatDateBR(l.training_date)}` : ""}</option>)}
                  </select>
                  {canImport && <Button variant="outline" onClick={() => setImporting(true)}><Upload />Importar nova lista</Button>}
                </div>
                {!lists.isLoading && !lists.data?.length && <p className="text-xs text-muted-foreground">Nenhuma lista deste público ainda.</p>}
              </section>

              {listId && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">2. Revisão</h3>
                  {preview.isLoading ? <p role="status" className="text-sm">Calculando destinatários…</p> : preview.isError ? <p role="alert" className="text-sm text-destructive">{(preview.error as Error).message}</p> : p && (
                    <>
                      {!p.audience_match && <p role="alert" className="text-sm text-destructive">Esta lista pertence a outro público.</p>}
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <Item k="Pesquisa" v={survey?.title} /><Item k="Público" v={audienceLabel(audience)} />
                        <Item k="Remetente" v={p.sender ? `${p.sender.name} <${p.sender.email}>` : "Não configurado"} />
                        <Item k="Destinatários válidos e únicos" v={`${p.new_recipients} novos${p.already_invited ? ` (${p.already_invited} já convidados)` : ""}`} />
                        <Item k="Excluídos por erro ou duplicidade (na importação)" v={String(excluded)} />
                        <Item k="Prazo" v={`até ${prazo}`} />
                        <Item k="Lembretes" v={reminderOn ? `1 lembrete após ${reminderDays} dias, só para não respondentes` : "Sem lembrete"} />
                      </dl>
                      {firstSend && (
                        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                          <div className="space-y-1"><Label htmlFor="snd-deadline">Prazo (dias)</Label><Input id="snd-deadline" type="number" min={1} max={90} value={deadlineDays} onChange={(e) => setDeadlineDays(Number(e.target.value))} /></div>
                          <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={reminderOn} onCheckedChange={setReminderOn} />Lembrete</label>
                          <div className="space-y-1"><Label htmlFor="snd-reminder">Lembrete após (dias)</Label><Input id="snd-reminder" type="number" min={1} max={60} disabled={!reminderOn} value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value))} /></div>
                        </div>
                      )}
                      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Prévia do e-mail</p>
                        <p className="font-semibold">{fillEmail(survey?.email_subject ?? "", vars)}</p>
                        <p className="whitespace-pre-wrap">{fillEmail(survey?.email_body ?? "", vars)}</p>
                      </div>
                    </>
                  )}
                </section>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button variant="outline" disabled={busy} onClick={sendTest}><FlaskConical />Enviar teste para mim</Button>
                <Button disabled={busy || !p || !p.audience_match || p.new_recipients === 0} onClick={send}><Send />{busy ? "Enviando…" : "Enviar pesquisa"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {survey && <ImportListWizard audience={audience} open={importing} defaultPurpose={survey.training_name || survey.track_id ? "attendance" : "recipients"} onClose={() => setImporting(false)} onImported={(id) => { setImporting(false); lists.refetch().then(() => setListId(id)); }} />}
    </>
  );
}
const Item = ({ k, v }: { k: string; v?: string | null }) => <div className="rounded-md bg-muted/50 p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>;
