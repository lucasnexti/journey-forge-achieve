import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchEnvironmentsReport, type EnvironmentRow } from "./AdminAmbientes";

const COLS: { key: keyof EnvironmentRow; label: string }[] = [
  { key: "users", label: "Usuários" }, { key: "active_users", label: "Ativos no período" },
  { key: "enrollments", label: "Matrículas" }, { key: "completions", label: "Conclusões" },
  { key: "certificates", label: "Certificados" }, { key: "exams_passed", label: "Provas aprovadas" }, { key: "coins", label: "Moedas" },
];

/** Visão consolidada de todos os ambientes — só o Master (o servidor recusa os demais). */
export default function AdminRelatoriosAmbientes() {
  const [params, setParams] = useSearchParams();
  const start = params.get("de") || null;
  const end = params.get("ate") || null;
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; });
  const q = useQuery({ queryKey: ["environments-report", start, end], queryFn: () => fetchEnvironmentsReport(start, end) });
  const total = (k: keyof EnvironmentRow) => (q.data ?? []).reduce((s, r) => s + Number(r[k] || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1"><Label htmlFor="env-de">De</Label><Input id="env-de" type="date" value={start ?? ""} onChange={(e) => setParam("de", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="env-ate">Até</Label><Input id="env-ate" type="date" value={end ?? ""} onChange={(e) => setParam("ate", e.target.value)} /></div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Ambiente</TableHead>{COLS.map((c) => <TableHead key={c.key} className="text-right">{c.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {q.isLoading && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
            {q.error && <TableRow><TableCell colSpan={8} className="text-destructive">{(q.error as Error).message}</TableCell></TableRow>}
            {q.data?.map((r) => (
              <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell>{COLS.map((c) => <TableCell key={c.key} className="text-right">{Number(r[c.key]).toLocaleString("pt-BR")}</TableCell>)}</TableRow>
            ))}
          </TableBody>
          {!!q.data?.length && <TableFooter><TableRow><TableCell>Total</TableCell>{COLS.map((c) => <TableCell key={c.key} className="text-right">{total(c.key).toLocaleString("pt-BR")}</TableCell>)}</TableRow></TableFooter>}
        </Table>
      </div>
    </div>
  );
}
