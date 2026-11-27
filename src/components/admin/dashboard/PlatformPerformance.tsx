import { useCallback, useEffect, useState } from "react";
import { Activity, Gauge, RefreshCw, Server, Timer, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Level = { label: string; className: string };
const level = (ms: number | null | undefined): Level =>
  ms == null ? { label: "—", className: "text-muted-foreground" }
  : ms < 500 ? { label: "Rápido", className: "text-green-600" }
  : ms < 1500 ? { label: "Atenção", className: "text-amber-500" }
  : { label: "Lento", className: "text-destructive" };

const CHECKS: [string, () => PromiseLike<unknown>][] = [
  ["Cursos", () => supabase.from("tracks").select("id").limit(20)],
  ["Aulas", () => supabase.from("lessons").select("id").limit(20)],
  ["Matrículas", () => supabase.from("enrollments").select("id").limit(20)],
  ["Perfis", () => supabase.from("profiles").select("id").limit(20)],
];

type Snapshot = { captured_at: string; avg_response_ms: number | null; p95_response_ms: number | null; max_response_ms: number | null; error_rate: number | null; users_online: number | null; query_benchmarks: any };

const Card = ({ icon: Icon, label, value, hint, hintClass }: { icon: any; label: string; value: string; hint?: string; hintClass?: string }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    {hint && <p className={cn("text-xs font-medium", hintClass)}>{hint}</p>}
  </div>
);

const PlatformPerformance = () => {
  const [live, setLive] = useState<{ name: string; ms: number }[]>([]);
  const [server, setServer] = useState<any>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    const results: { name: string; ms: number }[] = [];
    for (const [name, fn] of CHECKS) {
      const s = performance.now(); await fn(); results.push({ name, ms: Math.round(performance.now() - s) });
    }
    setLive(results);
    const [{ data: m }, { data: snaps }] = await Promise.all([
      supabase.functions.invoke("performance-metrics"),
      supabase.from("performance_snapshots").select("captured_at,avg_response_ms,p95_response_ms,max_response_ms,error_rate,users_online,query_benchmarks").order("captured_at", { ascending: false }).limit(60),
    ]);
    setServer(m ?? null);
    setHistory(((snaps as Snapshot[]) ?? []).reverse());
    setLoading(false);
  }, []);
  useEffect(() => { run(); }, [run]);

  const liveAvg = live.length ? Math.round(live.reduce((a, b) => a + b.ms, 0) / live.length) : null;
  const srv = server?.responseTimeSummary;
  const errorRate = server?.reliability?.errorRate;
  const loadTest = [...history].reverse().find((s) => s.query_benchmarks?.type === "load_test");
  const chart = history.filter((s) => s.query_benchmarks?.type !== "load_test").map((s) => ({
    t: new Date(s.captured_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    media: Number(s.avg_response_ms ?? 0), p95: Number(s.p95_response_ms ?? 0),
  }));
  const overall = level(Math.max(liveAvg ?? 0, Number(srv?.p95 ?? 0)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          {overall.label === "Rápido" ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <AlertTriangle className={cn("h-6 w-6", overall.className)} />}
          <div>
            <p className="text-sm font-semibold">Situação agora: <span className={overall.className}>{loading && !live.length ? "medindo..." : overall.label}</span></p>
            <p className="text-xs text-muted-foreground">Rápido: abaixo de 0,5 s · Atenção: até 1,5 s · Lento: acima de 1,5 s</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading} className="gap-1.5"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Medir novamente</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Timer} label="Resposta vista pelo seu navegador" value={liveAvg != null ? `${liveAvg} ms` : "—"} hint={level(liveAvg).label} hintClass={level(liveAvg).className} />
        <Card icon={Server} label="Resposta média do servidor" value={srv ? `${Math.round(srv.avg)} ms` : "—"} hint={level(srv?.avg).label} hintClass={level(srv?.avg).className} />
        <Card icon={Gauge} label="Pior caso (95% das consultas)" value={srv ? `${Math.round(srv.p95)} ms` : "—"} hint={level(srv?.p95).label} hintClass={level(srv?.p95).className} />
        <Card icon={Activity} label="Erros nas últimas 24h" value={errorRate != null ? `${Number(errorRate).toFixed(1)}%` : "—"} hint={errorRate == null ? undefined : errorRate < 1 ? "Normal" : "Acima do esperado"} hintClass={errorRate < 1 ? "text-green-600" : "text-destructive"} />
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Tempo de cada área (agora)</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {live.map((c) => <div key={c.name} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{c.name}</p><p className="font-semibold tabular-nums">{c.ms} ms <span className={cn("text-xs", level(c.ms).className)}>{level(c.ms).label}</span></p></div>)}
        </div>
      </section>

      {loadTest && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />Último teste de esforço — {loadTest.users_online} usuários simultâneos</h3>
          <p className="mb-3 text-xs text-muted-foreground">{new Date(loadTest.captured_at).toLocaleString("pt-BR")} · {loadTest.query_benchmarks.requests} acessos em {loadTest.query_benchmarks.duration_s} s · {Number(loadTest.error_rate ?? 0)}% de erros</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(loadTest.query_benchmarks.steps ?? {}).map(([n, v]: [string, any]) => (
              <div key={n} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{n}</p><p className="font-semibold tabular-nums">{v.avg} ms</p><p className={cn("text-xs", level(v.p95).className)}>pior caso {v.p95} ms</p></div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico de tempo de resposta</h3>
        {chart.length ? (
          <div className="h-56"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} unit=" ms" width={60} /><Tooltip />
              <Line type="monotone" dataKey="media" name="Média" stroke="hsl(var(--primary))" dot={false} /><Line type="monotone" dataKey="p95" name="Pior caso" stroke="#f59e0b" dot={false} /></LineChart>
          </ResponsiveContainer></div>
        ) : <p className="text-sm text-muted-foreground">Ainda não há medições salvas. Elas aparecem conforme o monitoramento registra novas medições.</p>}
      </section>
    </div>
  );
};
export default PlatformPerformance;
