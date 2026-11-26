import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, RefreshCw, Upload, Users } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ImportListWizard from "@/components/research/ImportListWizard";
import EmployeeBaseTab from "@/components/research/EmployeeBaseTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { todaySP } from "@/lib/research";
import { tdRows, validTDPeriod, type TDReportData, type TDStatus } from "@/lib/tdReport";

const statusClasses: Record<TDStatus, string> = {
  Verde: "border-success/30 bg-success/10 text-foreground",
  Amarelo: "border-warning/40 bg-warning/15 text-foreground",
  Vermelho: "border-destructive/30 bg-destructive/10 text-foreground",
  "Sem dados": "border-border bg-muted text-muted-foreground",
  "A validar": "border-primary/30 bg-primary/10 text-foreground",
};
const dotClasses: Record<TDStatus, string> = { Verde: "bg-success", Amarelo: "bg-warning", Vermelho: "bg-destructive", "Sem dados": "bg-muted-foreground", "A validar": "bg-primary" };
const periodLabel = (period: string) => /^\d{4}-\d{2}-\d{2}$/.test(period)
  ? new Date(`${period}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : period;

export default function AdminRelatoriosTD() {
  const today = todaySP();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ start: `${today.slice(0,7)}-01`, end: today, area: "all", track: "all" });
  const [applied, setApplied] = useState(filters);
  const [importing, setImporting] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const valid = validTDPeriod(filters.start, filters.end);
  const report = useQuery({
    queryKey: ["admin-td-report", user?.id, applied], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_td_report", { _start: applied.start, _end: applied.end, _area: applied.area === "all" ? null : applied.area, _track: applied.track === "all" ? null : applied.track });
      if (error) throw error;
      return data as unknown as TDReportData;
    },
  });
  const rows = useMemo(() => report.data ? tdRows(report.data, applied.start, applied.end, applied.area === "all" ? null : applied.area) : [], [report.data, applied]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-td-report"] });
  const update = (key: keyof typeof filters, value: string) => setFilters(f => ({...f, [key]: value}));
  return (
    <AdminLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="font-display text-xl font-bold text-primary">Relatórios de T&D</h1><p className="mt-2 text-sm text-muted-foreground">Responsável pelos dados: <span className="font-medium text-foreground">Daniela</span>{report.data && ` · ${report.data.company}`}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Importar presença</Button>
            <Button variant="outline" onClick={() => setBaseOpen(true)}><Users className="h-4 w-4" />Base de colaboradores</Button>
            <Button variant="ghost" size="icon" aria-label="Atualizar relatório" title="Atualizar relatório" onClick={() => report.refetch()} disabled={report.isFetching}><RefreshCw className={`h-4 w-4 ${report.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button>
          </div>
        </header>
        <form className="grid items-end gap-4 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.6fr_auto]" onSubmit={e => { e.preventDefault(); if(valid) setApplied({...filters}); }}>
          <div className="space-y-2"><Label htmlFor="td-start">De</Label><Input id="td-start" type="date" value={filters.start} onChange={e=>update("start",e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="td-end">Até</Label><Input id="td-end" type="date" value={filters.end} onChange={e=>update("end",e.target.value)} required /></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="td-area">Área</Label><Select value={filters.area} onValueChange={v=>update("area",v)}><SelectTrigger id="td-area"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as áreas</SelectItem>{report.data?.areas.map(a=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="td-track">Treinamento</Label><Select value={filters.track} onValueChange={v=>update("track",v)}><SelectTrigger id="td-track" className="[&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os treinamentos</SelectItem>{report.data?.tracks.map(t=><SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={!valid || report.isFetching}><Filter className="h-4 w-4" />Aplicar filtros</Button>
          {!valid && <p role="alert" className="text-sm text-destructive sm:col-span-2">Informe um período válido de até três anos.</p>}
        </form>
        {report.isLoading ? <p role="status" className="py-10 text-center text-muted-foreground">Carregando indicadores…</p> : report.isError ? <div role="alert" className="space-y-3 py-8"><p className="text-destructive">Não foi possível consultar o relatório. Verifique se sua conta está ativa e vinculada a uma empresa autorizada.</p><Button variant="outline" onClick={()=>report.refetch()}>Tentar novamente</Button></div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">Apuração: {new Date(`${applied.start}T12:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${applied.end}T12:00:00`).toLocaleDateString("pt-BR")}</p><div className="flex flex-wrap gap-3">{["Verde","Amarelo","Vermelho"].map(s=><span key={s} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${dotClasses[s as TDStatus]}`} />{s}</span>)}</div></div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1060px] text-left text-sm" aria-label="Indicadores de treinamento e desenvolvimento">
              <thead className="bg-muted text-xs text-muted-foreground"><tr>{["Pilar","Indicador","Período de apuração","Resultado","Meta","Status","Fonte dos dados"].map(h=><th key={h} scope="col" className="p-4 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{rows.map(row=><tr key={row.key} className="border-t border-border align-top hover:bg-muted/40">
                <td className="p-4 text-muted-foreground">{row.indicator.pillar}</td>
                <td className="w-[290px] p-4"><p className="font-medium">{row.indicator.name}</p>{row.detail && <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>}</td>
                <td className="p-4"><p>{periodLabel(row.period)}</p><p className="mt-1 text-xs text-muted-foreground">{row.indicator.cadence}</p></td>
                <td className="p-4 font-medium tabular-nums whitespace-nowrap">{row.value === null ? row.status === "A validar" ? "A validar" : "Sem dados" : `${row.value.toLocaleString("pt-BR",{ maximumFractionDigits:2 })}${row.indicator.unit}`}</td>
                <td className="p-4 tabular-nums whitespace-nowrap">≥ {row.indicator.target.toLocaleString("pt-BR")}{row.indicator.unit}</td>
                <td className="p-4"><Badge variant="outline" className={`gap-1.5 whitespace-nowrap ${statusClasses[row.status]}`}><span className={`h-1.5 w-1.5 rounded-full ${dotClasses[row.status]}`} />{row.status}</Badge></td>
                <td className="min-w-[260px] max-w-[360px] p-4"><p>{row.source}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{row.reason}</p></td>
              </tr>)}</tbody>
            </table>
          </div>
          <section className="border-t border-border pt-5 text-sm"><h2 className="font-semibold">Fontes e validações pendentes</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Planejamento: Ações Internas / Google Agenda. Sem importador compatível; integração externa não habilitada.</li>
            <li>Presença e ativos: importação existente de planilhas. Vincular ao ID do treinamento e identificar pessoas por ID ou e-mail. Sem união automática por nome.</li>
            <li>Avaliações: NPS e conteúdo podem usar pesquisas internas vinculadas ao curso. Feedz ainda sem importador compatível.</li>
            <li>Daniela: validar critério de colaborador treinado, base de ativos e sua data de referência, contabilização das horas e recorte mensal das obrigações.</li>
            <li>Os indicadores mensais são separados por mês; os trimestrais mostram o trimestre correspondente. Recortes parciais não equivalem a um trimestre completo. As metas usam valores sem arredondamento.</li>
          </ul></section>
        </>}
      </div>
      <ImportListWizard audience="interno" open={importing} onClose={()=>setImporting(false)} onImported={()=>{ setImporting(false); refresh(); }} />
      <Dialog open={baseOpen} onOpenChange={open=>{setBaseOpen(open); if(!open) refresh();}}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Base de colaboradores · Interno Nexti</DialogTitle><DialogDescription>Importações versionadas com data de referência. Responsável pelos dados: Daniela.</DialogDescription></DialogHeader><EmployeeBaseTab audience="interno" canImport /></DialogContent></Dialog>
    </AdminLayout>
  );
}