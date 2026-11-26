import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { FileDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { csatPercent, formatDateBR, formatDateTimeBR, npsScore, participationRate, reachPercent, SEND_STATUS, showValue, type Audience } from "@/lib/research";
import { downloadWorkbook } from "@/lib/spreadsheet";
import SurveyResults from "./SurveyResults";

interface Dist { score: number; count: number }
interface Dash {
  counts: { invited: number; sent_ok: number; delivered: number; failed: number; blocked_config: number; pending: number; responded: number; responded_of_sent: number; non_responded: number };
  nps: { n: number; promoters: number; passives: number; detractors: number; avg: number | null; dist: Dist[] };
  csat: { n: number; satisfied: number; avg: number | null; dist: Dist[] };
  scales: { question_id: string; prompt: string; survey: string; n: number; avg: number; min: number; max: number }[];
  choices: { question_id: string; prompt: string; survey: string; n: number; options: { label: string; count: number }[] }[];
  comments: { text: string; question: string; survey: string; submitted_at: string; company: string | null; area: string | null; name: string | null; email: string | null }[];
  timeline: { period: string; responses: number; nps_n: number; nps_p: number; nps_d: number; csat_n: number; csat_s: number }[];
  identified: boolean;
}
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

export default function ResearchDashboard({ audience }: { audience: Audience }) {
  const [f, setF] = useState({ survey_id: "", training: "", track_id: "", class_name: "", company: "", area: "", responded: "all", send_status: "", date_basis: "sent", from: "", to: "" });
  const [reachBase, setReachBase] = useState("");
  const [participants, setParticipants] = useState(false);
  const [anonymousSurvey, setAnonymousSurvey] = useState("");
  const filters = { ...f, audience };
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const opts = useQuery({ queryKey: ["research-filter-options", audience], queryFn: async () => { const { data, error } = await supabase.rpc("research_filter_options", { _audience: audience }); if (error) throw error; return data as { trainings: string[]; companies: string[]; areas: string[]; classes: string[]; courses: { id: string; title: string }[] }; } });
  const surveys = useQuery({ queryKey: ["research-surveys", audience], queryFn: async () => { const { data, error } = await supabase.from("research_surveys").select("*").eq("audience", audience).order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const dash = useQuery({ queryKey: ["research-dashboard", filters], queryFn: async () => { const { data, error } = await supabase.rpc("research_dashboard", { _f: filters }); if (error) throw error; return data as unknown as Dash; } });
  const bases = useQuery({ queryKey: ["research-bases", audience], queryFn: async () => { const { data, error } = await supabase.from("research_employee_bases").select("id,company_name,version,reference_date").eq("audience", audience).order("company_name").order("version", { ascending: false }); if (error) throw error; return data; } });
  const reachFrom = f.from; const reachTo = f.to;
  const reach = useQuery({
    queryKey: ["research-reach", audience, reachBase, reachFrom, reachTo, f.area], enabled: !!reachBase,
    queryFn: async () => { const { data, error } = await supabase.rpc("research_reach", { _f: { audience, base_id: reachBase, from: reachFrom, to: reachTo, area: f.area } }); if (error) throw error; return data as { status: string; reason?: string; denominator?: number; numerator?: number; from_attendance?: number; from_courses?: number; unmatched_participants?: number; without_email?: number; base?: { company: string; reference_date: string; version: number } }; },
  });
  const exportData = useQuery({ queryKey: ["research-export", filters], enabled: participants, queryFn: async () => { const { data, error } = await supabase.rpc("research_export", { _f: filters }); if (error) throw error; return data as { identified: boolean; invitations: Record<string, unknown>[]; answers: Record<string, unknown>[] }; } });

  const d = dash.data;
  const nps = d ? npsScore(d.nps.promoters, d.nps.detractors, d.nps.n) : null;
  const csat = d ? csatPercent(d.csat.satisfied, d.csat.n) : null;
  const part = d ? participationRate(d.counts.responded_of_sent, d.counts.sent_ok) : null;
  const timeline = useMemo(() => (d?.timeline ?? []).map((t) => ({ period: t.period.split("-").reverse().join("/"), Respostas: t.responses, NPS: npsScore(t.nps_p, t.nps_d, t.nps_n), "CSAT %": csatPercent(t.csat_s, t.csat_n) })), [d]);
  const basisLabel = { training: "data do treinamento", sent: "data do envio", response: "data da resposta" }[f.date_basis];

  const doExport = async () => {
    try {
      const { data, error } = await supabase.rpc("research_export", { _f: filters });
      if (error) throw error;
      const x = data as { identified: boolean; invitations: Record<string, unknown>[]; answers: Record<string, unknown>[] };
      const strip = (r: Record<string, unknown>) => { const o = { ...r }; if (!x.identified) { delete o.name; delete o.email; } return o; };
      const pt = (rows: Record<string, unknown>[], map: Record<string, string>) => rows.map((r) => Object.fromEntries(Object.entries(map).filter(([k]) => k in strip(r)).map(([k, l]) => [l, fmtCell(k, r[k])])));
      downloadWorkbook(`pesquisas-${audience}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: "Resumo", rows: d ? [
          { Indicador: "Público", Valor: audience === "interno" ? "Interno Nexti" : "Clientes" },
          { Indicador: "Período", Valor: f.from || f.to ? `${formatDateBR(f.from || null)} a ${formatDateBR(f.to || null)} (${basisLabel})` : "Todo o período" },
          { Indicador: "Convites enviados com sucesso", Valor: d.counts.sent_ok }, { Indicador: "Respostas", Valor: d.counts.responded },
          { Indicador: "Taxa de participação (%)", Valor: showValue(part) }, { Indicador: `NPS (n=${d.nps.n})`, Valor: showValue(nps) },
          { Indicador: `CSAT % (n=${d.csat.n})`, Valor: showValue(csat) }, { Indicador: `Média CSAT (n=${d.csat.n})`, Valor: showValue(d.csat.avg) },
        ] : [] },
        { name: "Convites", rows: pt(x.invitations.map(strip), { survey: "Pesquisa", version: "Versão", name: "Nome", email: "E-mail", company: "Empresa", area: "Área", training: "Treinamento", training_date: "Data do treinamento", class_name: "Turma", course: "Curso", send_status: "Status de envio", sent_at: "Enviado em", delivered_at: "Entregue em", responded_at: "Respondido em", reminders: "Lembretes" }) },
        { name: "Respostas", rows: pt(x.answers.map(strip), { survey: "Pesquisa", question: "Pergunta", indicator: "Indicador", value: "Nota", choices: "Escolhas", text: "Comentário", submitted_at: "Respondido em", name: "Nome", email: "E-mail", company: "Empresa", area: "Área", training: "Treinamento" }) },
      ]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível exportar."); }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2 border-b border-border pb-4"><Label htmlFor="anon-results">Resultados de pesquisas anônimas</Label><select id="anon-results" className={sel} value={anonymousSurvey} onChange={e=>setAnonymousSurvey(e.target.value)}><option value="">Indicadores de pesquisas identificadas</option>{(surveys.data ?? []).filter(s=>s.anonymous).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><p className="text-xs text-muted-foreground">Pesquisas anônimas são consultadas por pesquisa, sem recortes por pessoa, área, empresa ou horário de resposta.</p></div>
      {anonymousSurvey ? <SurveyResults surveyId={anonymousSurvey} /> : <>
      <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros">
        <div className="space-y-1"><Label htmlFor="f-survey">Pesquisa</Label><select id="f-survey" className={sel} value={f.survey_id} onChange={(e) => set("survey_id", e.target.value)}><option value="">Todas as identificadas</option>{(surveys.data ?? []).filter(s=>!s.anonymous).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-training">Treinamento</Label><select id="f-training" className={sel} value={f.training} onChange={(e) => set("training", e.target.value)}><option value="">Todos</option>{(opts.data?.trainings ?? []).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-course">Curso</Label><select id="f-course" className={sel} value={f.track_id} onChange={(e) => set("track_id", e.target.value)}><option value="">Todos</option>{(opts.data?.courses ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-class">Turma</Label><select id="f-class" className={sel} value={f.class_name} onChange={(e) => set("class_name", e.target.value)}><option value="">Todas</option>{(opts.data?.classes ?? []).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-company">Empresa</Label><select id="f-company" className={sel} value={f.company} onChange={(e) => set("company", e.target.value)}><option value="">Todas</option>{(opts.data?.companies ?? []).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-area">Área</Label><select id="f-area" className={sel} value={f.area} onChange={(e) => set("area", e.target.value)}><option value="">Todas</option>{(opts.data?.areas ?? []).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-resp">Respostas</Label><select id="f-resp" className={sel} value={f.responded} onChange={(e) => set("responded", e.target.value)}><option value="all">Respondidos e não respondidos</option><option value="yes">Somente respondidos</option><option value="no">Somente não respondidos</option></select></div>
        <div className="space-y-1"><Label htmlFor="f-send">Status de envio</Label><select id="f-send" className={sel} value={f.send_status} onChange={(e) => set("send_status", e.target.value)}><option value="">Todos</option>{Object.entries(SEND_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="f-basis">Período considera a</Label><select id="f-basis" className={sel} value={f.date_basis} onChange={(e) => set("date_basis", e.target.value)}><option value="sent">Data do envio</option><option value="training">Data do treinamento</option><option value="response">Data da resposta</option></select></div>
        <div className="space-y-1"><Label htmlFor="f-from">De</Label><Input id="f-from" type="date" value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="f-to">Até</Label><Input id="f-to" type="date" value={f.to} onChange={(e) => set("to", e.target.value)} /></div>
        <div className="flex items-end gap-2"><Button variant="outline" className="flex-1" onClick={doExport}><FileDown />Exportar Excel</Button></div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{f.from || f.to ? `Período pela ${basisLabel}: ${formatDateBR(f.from || null)} a ${formatDateBR(f.to || null)}.` : "Sem filtro de período."} Indicadores consolidados a partir de todas as respostas válidas (sem média entre pesquisas).</p>
      </section>

      {dash.isLoading ? <p role="status">Calculando indicadores…</p> : dash.isError ? <p role="alert" className="text-destructive">{(dash.error as Error).message}</p> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Card label="Convites enviados" value={d.counts.sent_ok} hint={`${d.counts.invited} convites criados`} />
            <Card label="Entregas confirmadas" value={d.counts.delivered ? d.counts.delivered : "Sem dados"} hint="Somente com confirmação do provedor" />
            <Card label="Falhas de envio" value={d.counts.failed} hint={d.counts.blocked_config ? `${d.counts.blocked_config} aguardando configuração` : d.counts.pending ? `${d.counts.pending} na fila` : undefined} />
            <Card label="Respostas recebidas" value={d.counts.responded} />
            <Card label="Não respondentes" value={d.counts.non_responded} />
            <Card label="Taxa de participação" value={showValue(part, "%")} hint={`${d.counts.responded_of_sent} de ${d.counts.sent_ok} enviados`} />
            <Card label="Comentários" value={d.comments.length} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between"><h3 className="font-semibold">NPS</h3><span className="text-xs text-muted-foreground">{d.nps.n} respostas</span></div>
              <p className="font-display text-4xl font-bold text-primary">{showValue(nps)}</p>
              {d.nps.n > 0 && <p className="text-xs text-muted-foreground">Promotores {d.nps.promoters} ({Math.round(d.nps.promoters / d.nps.n * 100)}%) · Neutros {d.nps.passives} ({Math.round(d.nps.passives / d.nps.n * 100)}%) · Detratores {d.nps.detractors} ({Math.round(d.nps.detractors / d.nps.n * 100)}%) · Média {showValue(d.nps.avg)}</p>}
              <div className="mt-3 h-48">{d.nps.n ? <ResponsiveContainer><BarChart data={d.nps.dist}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="score" /><YAxis allowDecimals={false} width={30} /><Tooltip /><Bar dataKey="count" name="Respostas" fill={PRIMARY} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty />}</div>
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between"><h3 className="font-semibold">CSAT</h3><span className="text-xs text-muted-foreground">{d.csat.n} respostas</span></div>
              <p className="font-display text-4xl font-bold text-primary">{showValue(csat, "%")}</p>
              <p className="text-xs text-muted-foreground">Média das notas (1 a 5): <strong>{showValue(d.csat.avg)}</strong> · {d.csat.satisfied} notas 4 ou 5</p>
              <div className="mt-3 h-48">{d.csat.n ? <ResponsiveContainer><BarChart data={d.csat.dist}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="score" /><YAxis allowDecimals={false} width={30} /><Tooltip /><Bar dataKey="count" name="Respostas" fill={PRIMARY} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty />}</div>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold">Evolução por mês de resposta</h3>
            <div className="mt-3 h-56">{timeline.length ? <ResponsiveContainer><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis width={36} /><Tooltip /><Legend /><Line type="monotone" dataKey="NPS" stroke={PRIMARY} strokeWidth={2} connectNulls /><Line type="monotone" dataKey="CSAT %" stroke={MUTED} strokeWidth={2} connectNulls /><Line type="monotone" dataKey="Respostas" stroke="hsl(var(--accent-foreground))" strokeDasharray="4 4" /></LineChart></ResponsiveContainer> : <Empty />}</div>
          </section>

          {(d.scales.length > 0 || d.choices.length > 0) && (
            <section className="grid gap-4 lg:grid-cols-2">
              {d.scales.map((s) => <div key={s.question_id} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{s.survey}</p><p className="font-medium">{s.prompt}</p><p className="mt-1 text-2xl font-bold text-primary">Média {showValue(s.avg)} <span className="text-sm font-normal text-muted-foreground">(escala {s.min}–{s.max} · {s.n} respostas)</span></p></div>)}
              {d.choices.map((c) => <div key={c.question_id} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{c.survey} · {c.n} respostas</p><p className="mb-2 font-medium">{c.prompt}</p><ul className="space-y-1 text-sm">{c.options.map((o) => <li key={o.label} className="flex items-center gap-2"><span className="w-40 truncate">{o.label}</span><span className="h-2 flex-1 rounded bg-muted"><span className="block h-2 rounded bg-primary" style={{ width: `${c.n ? (o.count / c.n) * 100 : 0}%` }} /></span><span className="w-8 text-right">{o.count}</span></li>)}</ul></div>)}
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Comentários</h3>{d.identified && <Button size="sm" variant="outline" onClick={() => setParticipants(true)}><Users />Ver participantes</Button>}</div>
            {!d.comments.length ? <p className="mt-2 text-sm text-muted-foreground">Sem dados</p> : (
              <ul className="mt-3 max-h-96 space-y-2 overflow-auto">{d.comments.map((c, i) => <li key={i} className="rounded-md bg-muted/50 p-3 text-sm"><p className="whitespace-pre-wrap">{c.text}</p><p className="mt-1 text-xs text-muted-foreground">{c.survey} · {formatDateTimeBR(c.submitted_at)}{c.company && ` · ${c.company}`}{c.area && ` · ${c.area}`}{c.name && ` · ${c.name} (${c.email})`}</p></li>)}</ul>
            )}
          </section>
        </>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">Alcance dos treinamentos</h3>
        <p className="text-xs text-muted-foreground">Pessoas ativas da base que participaram de ao menos um treinamento no período (presença importada ou conclusão de curso da universidade) ÷ pessoas ativas da mesma base. Usa o período e a área dos filtros acima, pela data do treinamento/conclusão.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-60 space-y-1"><Label htmlFor="reach-base">Base de referência</Label><select id="reach-base" className={sel} value={reachBase} onChange={(e) => setReachBase(e.target.value)}><option value="">Selecione</option>{(bases.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.company_name} · v{b.version} · {formatDateBR(b.reference_date)}</option>)}</select></div>
        </div>
        {!reachBase ? <p className="mt-3 text-sm font-medium">{bases.data?.length ? "Selecione a base de referência." : "Base insuficiente para cálculo"}</p> : reach.isLoading ? <p role="status" className="mt-3 text-sm">Calculando…</p> : reach.data && (
          reach.data.status !== "ok" ? <p className="mt-3 text-sm font-medium">Base insuficiente para cálculo{reach.data.reason ? ` — ${reach.data.reason}` : ""}</p> : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Alcance" value={showValue(reachPercent(reach.data.numerator!, reach.data.denominator!), "%")} hint={`${reach.data.numerator} de ${reach.data.denominator} pessoas ativas`} />
              <Card label="Por presença em treinamento" value={reach.data.from_attendance!} />
              <Card label="Por conclusão de curso" value={reach.data.from_courses!} />
              <Card label="Participantes fora da base" value={reach.data.unmatched_participants!} hint="Presentes no período e não encontrados na base" />
              <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Base {reach.data.base?.company} v{reach.data.base?.version}, referência {formatDateBR(reach.data.base?.reference_date)}.{reach.data.without_email ? ` ${reach.data.without_email} pessoas ativas sem e-mail não podem ser associadas a presenças.` : ""}</p>
            </div>
          )
        )}
      </section>

      <Dialog open={participants} onOpenChange={setParticipants}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Participantes</DialogTitle><DialogDescription>Conforme os filtros atuais.</DialogDescription></DialogHeader>
          {exportData.isLoading ? <p role="status">Carregando…</p> : (
            <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Pessoa</th><th className="p-2">Pesquisa</th><th className="p-2">Envio</th><th className="p-2">Resposta</th></tr></thead>
              <tbody>{(exportData.data?.invitations ?? []).slice(0, 1000).map((r, i) => <tr key={i} className="border-t border-border"><td className="p-2"><p className="font-medium">{String(r.name ?? "—")}</p><p className="text-xs text-muted-foreground">{String(r.email ?? "")}{r.company ? ` · ${r.company}` : ""}</p></td><td className="p-2 text-xs">{String(r.survey)}</td><td className="p-2 text-xs">{SEND_STATUS[String(r.send_status)]}</td><td className="p-2 text-xs">{r.responded_at ? formatDateTimeBR(String(r.responded_at)) : "Não respondido"}</td></tr>)}</tbody></table>
          )}
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
}

function fmtCell(k: string, v: unknown) {
  if (v === null || v === undefined) return "";
  if (k === "send_status") return SEND_STATUS[String(v)] ?? v;
  if (k === "indicator") return v === "nps" ? "NPS" : v === "csat" ? "CSAT" : "";
  if (/_at$/.test(k)) return formatDateTimeBR(String(v));
  if (k === "training_date") return formatDateBR(String(v));
  return v;
}
const Card = ({ label, value, hint }: { label: string; value: number | string; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
);
const Empty = () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>;
