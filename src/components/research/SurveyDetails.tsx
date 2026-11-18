import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { effectiveStatus, formatDateBR, formatDateTimeBR, JOB_KIND, JOB_STATUS, SEND_STATUS, SURVEY_STATUS, todaySP } from "@/lib/research";
import type { Tables } from "@/integrations/supabase/types";

type Survey = Tables<"research_surveys">;
interface Props { survey: Survey | null; canSend: boolean; canSeeIdentified: boolean; onClose: () => void; onChanged: () => void; }

export default function SurveyDetails({ survey, canSend, canSeeIdentified, onClose, onChanged }: Props) {
  const open = !!survey;
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const data = useQuery({
    queryKey: ["research-survey-details", survey?.id], enabled: open,
    queryFn: async () => {
      const id = survey!.id;
      const [inv, jobs, disp, changes] = await Promise.all([
        canSend || canSeeIdentified ? supabase.from("research_invitations").select("id,name,email,company,area,send_status,sent_at,delivered_at,responded_at,reminder_count,last_error").eq("survey_id", id).order("created_at") : Promise.resolve({ data: [], error: null }),
        canSend ? supabase.from("research_email_jobs").select("kind,status").eq("survey_id", id) : Promise.resolve({ data: [], error: null }),
        canSend || canSeeIdentified ? supabase.from("research_dispatches").select("*").eq("survey_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase.from("research_deadline_changes").select("*").eq("survey_id", id).order("changed_at", { ascending: false }),
      ]);
      for (const r of [inv, jobs, disp, changes]) if (r.error) throw r.error;
      return { inv: inv.data ?? [], jobs: jobs.data ?? [], disp: disp.data ?? [], changes: changes.data ?? [] };
    },
  });
  const status = survey ? effectiveStatus(survey.status, survey.deadline_at) : "draft";

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try { toast.success(await fn()); onChanged(); data.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); } finally { setBusy(false); }
  };
  const extend = () => run(async () => {
    const { error } = await supabase.rpc("research_extend_deadline", { _id: survey!.id, _new_date: newDate, _reason: reason });
    if (error) throw error; setNewDate(""); setReason("");
    return "Prazo prorrogado. Os links existentes continuam válidos. Nenhuma mensagem foi enviada.";
  });
  const notify = () => run(async () => {
    const { data: n, error } = await supabase.rpc("research_notify_extension", { _id: survey!.id });
    if (error) throw error;
    if (n) await supabase.functions.invoke("research-email-dispatch", { body: { action: "process" } });
    return `${n} avisos da nova data colocados na fila para quem ainda não respondeu.`;
  });
  const close = () => run(async () => { const { error } = await supabase.rpc("research_close_survey", { _id: survey!.id }); if (error) throw error; return "Pesquisa encerrada."; });
  const requeue = () => run(async () => {
    const { data: n, error } = await supabase.rpc("research_requeue_blocked", { _survey: survey!.id });
    if (error) throw error;
    const d = await supabase.functions.invoke("research-email-dispatch", { body: { action: "process" } });
    const r = d.data as { sent?: number; blocked?: number } | null;
    return `${n} e-mails reprocessados · enviados: ${r?.sent ?? 0} · aguardando configuração: ${r?.blocked ?? 0}`;
  });

  const inv = data.data?.inv ?? [];
  const counts = inv.reduce<Record<string, number>>((a, i) => { a[i.send_status] = (a[i.send_status] ?? 0) + 1; return a; }, {});
  const responded = inv.filter((i) => i.responded_at).length;
  const jobCounts = (data.data?.jobs ?? []).reduce<Record<string, number>>((a, j) => { const k = `${j.kind}|${j.status}`; a[k] = (a[k] ?? 0) + 1; return a; }, {});
  const filtered = inv.filter((i) => !search || `${i.name} ${i.email} ${i.company ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const blocked = (counts.blocked_config ?? 0) + (counts.failed ?? 0) + Object.entries(jobCounts).filter(([k]) => k.endsWith("|blocked_config") || k.endsWith("|failed")).reduce((a, [, v]) => a + v, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{survey?.title}<Badge variant="secondary">{SURVEY_STATUS[status]}</Badge>{survey && survey.version > 1 && <Badge variant="outline">v{survey.version}</Badge>}</DialogTitle>
          <DialogDescription>{survey?.first_sent_at ? `Primeiro envio em ${formatDateTimeBR(survey.first_sent_at)} · prazo até ${formatDateTimeBR(survey.deadline_at)}` : "Ainda não enviada"}</DialogDescription>
        </DialogHeader>
        {data.isLoading ? <p role="status">Carregando…</p> : data.isError ? <p role="alert" className="text-destructive">{(data.error as Error).message}</p> : (
          <Tabs defaultValue="envio">
            <TabsList className="flex-wrap"><TabsTrigger value="envio">Envios</TabsTrigger>{(canSend || canSeeIdentified) && <TabsTrigger value="convites">Convites ({inv.length})</TabsTrigger>}{canSend && <TabsTrigger value="prazo">Prazo</TabsTrigger>}</TabsList>
            <TabsContent value="envio" className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Convites", inv.length], ["Enviados", (counts.sent ?? 0) + (counts.delivered ?? 0)], ["Entregues (confirmados)", counts.delivered ?? 0], ["Respondidos", responded], ["Na fila", (counts.queued ?? 0) + (counts.sending ?? 0)], ["Aguardando configuração", counts.blocked_config ?? 0], ["Falhas", counts.failed ?? 0], ["Não respondentes", inv.filter((i) => !i.responded_at && ["sent", "delivered"].includes(i.send_status)).length]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v}</p></div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">"Entregue" só aparece quando o serviço de e-mail confirma a entrega; sem essa confirmação, o status fica em "Enviado".</p>
              {canSend && blocked > 0 && <Button variant="outline" disabled={busy} onClick={requeue}>Reprocessar e-mails pendentes ou com falha</Button>}
              {canSend && Object.keys(jobCounts).length > 0 && (
                <div><p className="mb-1 text-sm font-semibold">Processamento da fila</p><ul className="flex flex-wrap gap-2 text-xs">{Object.entries(jobCounts).map(([k, v]) => { const [kind, st] = k.split("|"); return <li key={k} className="rounded-full bg-muted px-3 py-1">{JOB_KIND[kind]} · {JOB_STATUS[st]}: {v}</li>; })}</ul></div>
              )}
              <div>
                <p className="mb-1 text-sm font-semibold">Histórico dos disparos</p>
                {!data.data?.disp.length ? <p className="text-sm text-muted-foreground">Nenhum disparo ainda.</p> : (
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">{data.data.disp.map((d) => <li key={d.id} className="flex flex-wrap justify-between gap-2 p-2"><span>{JOB_KIND[d.kind]} · {formatDateTimeBR(d.created_at)}</span><span className="text-muted-foreground">{d.recipients} destinatários{d.skipped_existing ? ` · ${d.skipped_existing} já convidados` : ""}</span></li>)}</ul>
                )}
              </div>
            </TabsContent>
            <TabsContent value="convites" className="space-y-3 pt-3">
              <Input placeholder="Buscar por nome, e-mail ou empresa" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar convites" />
              <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
                <table className="w-full text-sm"><thead className="sticky top-0 bg-muted text-left text-xs"><tr><th className="p-2">Pessoa</th><th className="p-2">Empresa / Área</th><th className="p-2">Envio</th><th className="p-2">Resposta</th></tr></thead>
                  <tbody>{filtered.slice(0, 500).map((i) => (
                    <tr key={i.id} className="border-t border-border"><td className="p-2"><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.email}</p></td><td className="p-2 text-xs">{i.company || "—"}{i.area && ` · ${i.area}`}</td>
                      <td className="p-2 text-xs"><Badge variant={i.send_status === "failed" || i.send_status === "blocked_config" ? "destructive" : "secondary"}>{SEND_STATUS[i.send_status]}</Badge>{i.sent_at && <p className="mt-1 text-muted-foreground">{formatDateTimeBR(i.sent_at)}</p>}{i.reminder_count > 0 && <p className="text-muted-foreground">Lembretes: {i.reminder_count}</p>}{i.last_error && <p className="mt-1 text-destructive">{i.last_error}</p>}</td>
                      <td className="p-2 text-xs">{i.responded_at ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Respondido {formatDateBR(i.responded_at)}</Badge> : "Não respondido"}</td></tr>
                  ))}</tbody></table>
              </div>
            </TabsContent>
            <TabsContent value="prazo" className="space-y-4 pt-3">
              {!survey?.first_sent_at ? <p className="text-sm text-muted-foreground">O prazo começa a contar no primeiro envio.</p> : (
                <>
                  <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                    <div className="space-y-1"><Label htmlFor="ext-date">Nova data final</Label><Input id="ext-date" type="date" min={todaySP()} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label htmlFor="ext-reason">Motivo</Label><Input id="ext-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                    <div className="sm:col-span-3 flex flex-wrap gap-2"><Button disabled={busy || !newDate} onClick={extend}>Prorrogar</Button>{status === "active" && <Button variant="outline" disabled={busy} onClick={close}>Encerrar agora</Button>}</div>
                    <p className="sm:col-span-3 text-xs text-muted-foreground">A prorrogação mantém os links válidos e não reenvia mensagens automaticamente.</p>
                  </div>
                  {status === "active" && (data.data?.changes.length ?? 0) > 0 && <Button variant="outline" disabled={busy} onClick={notify}>Comunicar nova data aos não respondentes</Button>}
                  <div><p className="mb-1 text-sm font-semibold">Alterações de prazo</p>{!data.data?.changes.length ? <p className="text-sm text-muted-foreground">Nenhuma prorrogação.</p> : <ul className="divide-y divide-border rounded-md border border-border text-sm">{data.data.changes.map((c) => <li key={c.id} className="p-2">{formatDateTimeBR(c.previous_deadline)} → <strong>{formatDateTimeBR(c.new_deadline)}</strong><span className="text-muted-foreground"> · em {formatDateTimeBR(c.changed_at)}{c.reason && ` · ${c.reason}`}</span></li>)}</ul>}</div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
