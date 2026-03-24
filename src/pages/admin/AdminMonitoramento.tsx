import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import {
  Activity, Wifi, BookOpen, GraduationCap, Trophy,
  ShieldCheck, Bell, Gift, Clock,
  RefreshCw, Server, Zap, AlertTriangle, CheckCircle2,
  TrendingUp, BarChart3, FileText, Plus, Trash2, Play, History,
  Settings2, Timer, HardDrive, Video, MonitorCheck,
  CircleCheck, CircleX, Layers, Globe, UserPlus,
  Gauge, ArrowUp, ArrowDown, Minus, Database, Shield,
  Eye, MessageSquare, Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { KpiGauge, StatCard, SectionTitle, type SystemMetrics } from "@/components/admin/MonitoringComponents";

/* ─── Types ─── */
interface AlertRule {
  id: string; metric_key: string; metric_label: string; operator: string;
  threshold: number; is_active: boolean; cooldown_minutes: number; created_at: string;
}

interface AlertHistoryEntry {
  id: string; metric_key: string; metric_value: number; threshold: number;
  triggered_at: string; rule_id: string;
}

interface PerformanceMetrics {
  timestamp: string;
  executionTime: number;
  queryBenchmarks: { name: string; endpoint: string; ms: number; category: string }[];
  responseTimeSummary: { avg: number; max: number; p95: number };
  reliability: { errorCount: number; totalActions: number; errorRate: number; uptimeProxy: number };
  throughput: { lessonProgressPerHour: number; quizAttemptsPerHour: number; enrollmentsPerHour: number };
  dataVolume: Record<string, number>;
  lmsHealth: { videoAvailability: number; contentCompleteness: number; quizCoverage: number; quizPassRate?: number; profileCompleteness?: number; lessonDescCoverage?: number };
  slos: { name: string; category: string; target: number; actual: number; met: boolean; weight: number }[];
  sloByCategory?: { category: string; total: number; met: number; score: number }[];
  sloScore: number;
}

/* ─── Constants ─── */
const METRIC_OPTIONS = [
  { key: "users_online", label: "Usuários online", icon: Wifi },
  { key: "training_pending", label: "Treinamentos pendentes", icon: Clock },
  { key: "redemptions_pending", label: "Resgates pendentes", icon: Gift },
  { key: "lessons_completed_today", label: "Aulas concluídas hoje", icon: CheckCircle2 },
  { key: "enrollments_today", label: "Matrículas hoje", icon: GraduationCap },
  { key: "unread_notifications", label: "Notificações não lidas", icon: Bell },
  { key: "certificates_total", label: "Total de certificados", icon: ShieldCheck },
];

const OPERATOR_LABELS: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

/* ─── MAIN COMPONENT ─── */
const AdminMonitoramento = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superLoading } = useIsSuperAdmin();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Performance state
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [snapshotRange, setSnapshotRange] = useState<"24h" | "7d" | "30d">("24h");

  // Alert state
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [newMetricKey, setNewMetricKey] = useState("");
  const [newOperator, setNewOperator] = useState("gte");
  const [newThreshold, setNewThreshold] = useState("");
  const [newCooldown, setNewCooldown] = useState("60");
  const [runningHeal, setRunningHeal] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke("system-metrics");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setMetrics(data as SystemMetrics);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlertData = useCallback(async () => {
    setLoadingAlerts(true);
    const [{ data: rules }, { data: history }] = await Promise.all([
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_history").select("*").order("triggered_at", { ascending: false }).limit(50),
    ]);
    setAlertRules((rules || []) as AlertRule[]);
    setAlertHistory((history || []) as AlertHistoryEntry[]);
    setLoadingAlerts(false);
  }, []);

  const fetchPerfMetrics = useCallback(async () => {
    setLoadingPerf(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("performance-metrics");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setPerfMetrics(data as PerformanceMetrics);
    } catch (e: any) {
      toast.error("Erro ao carregar métricas de performance: " + (e.message || ""));
    } finally {
      setLoadingPerf(false);
    }
  }, []);

  const fetchSnapshots = useCallback(async (range: "24h" | "7d" | "30d") => {
    setLoadingSnapshots(true);
    const hours = range === "24h" ? 24 : range === "7d" ? 168 : 720;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("performance_snapshots")
      .select("*")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(500);
    setSnapshots(data || []);
    setLoadingSnapshots(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) { fetchMetrics(); fetchAlertData(); }
  }, [isSuperAdmin, fetchMetrics, fetchAlertData]);

  const handleAddRule = async () => {
    if (!user || !newMetricKey || !newThreshold) return;
    const metricOption = METRIC_OPTIONS.find((m) => m.key === newMetricKey);
    if (!metricOption) return;
    const { error } = await supabase.from("alert_rules").insert({
      metric_key: newMetricKey, metric_label: metricOption.label,
      operator: newOperator, threshold: parseFloat(newThreshold),
      cooldown_minutes: parseInt(newCooldown) || 60, created_by: user.id,
    });
    if (error) { toast.error("Erro ao criar regra: " + error.message); }
    else { toast.success("Regra de alerta criada!"); setNewMetricKey(""); setNewThreshold(""); fetchAlertData(); }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    await supabase.from("alert_rules").update({ is_active: isActive }).eq("id", ruleId);
    setAlertRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, is_active: isActive } : r)));
  };

  const handleDeleteRule = async (ruleId: string) => {
    await supabase.from("alert_rules").delete().eq("id", ruleId);
    setAlertRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success("Regra removida");
  };

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-alerts");
      if (error) throw error;
      if (data?.triggered > 0) toast.warning(`${data.triggered} alerta(s) disparado(s)!`);
      else toast.success("Nenhum alerta disparado. Tudo normal.");
      fetchAlertData();
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setCheckingAlerts(false); }
  };

  const handleAutoHeal = async () => {
    setRunningHeal(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-heal");
      if (error) throw error;
      if (data?.fixed > 0) {
        toast.success(`✅ ${data.fixed} correção(ões) automática(s) aplicada(s)!`);
      }
      if (data?.alerts > 0) {
        toast.warning(`⚠️ ${data.alerts} item(ns) precisam de atenção manual.`);
      }
      if (data?.fixed === 0 && data?.alerts === 0) {
        toast.success("Sistema saudável! Nenhuma ação necessária.");
      }
      // Refresh performance metrics after heal
      fetchPerfMetrics();
    } catch (e: any) {
      toast.error("Erro no auto-heal: " + (e.message || ""));
    } finally {
      setRunningHeal(false);
    }
  };

  if (authLoading || superLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!user || !isSuperAdmin) return <Navigate to="/admin" replace />;

  const m = metrics;

  return (
    <AdminLayout>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur-sm border bg-emerald-500/20 border-emerald-500/30">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-tight">
                    Centro de Monitoramento
                  </h1>
                  <p className="text-xs text-white/60">Performance, Operações & Alertas — Super Admin</p>
                </div>
              </div>
            </motion.div>
            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-[10px] text-white/40">
                  {lastRefresh.toLocaleTimeString("pt-BR")}
                </span>
              )}
              <Button size="sm" variant="outline" onClick={fetchMetrics} disabled={loading}
                className="border-white/20 text-white hover:bg-white/10 h-8 text-xs">
                <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} /> Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with tabs */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        {error && (
          <div className="card-surface border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="performance" className="text-xs gap-1.5" onClick={() => { if (!perfMetrics && !loadingPerf) { fetchPerfMetrics(); fetchSnapshots(snapshotRange); } }}>
              <Timer className="h-3.5 w-3.5" />Performance
            </TabsTrigger>
            <TabsTrigger value="operations" className="text-xs gap-1.5"><Server className="h-3.5 w-3.5" />Operações</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />Alertas
              {alertRules.filter((r) => r.is_active).length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {alertRules.filter((r) => r.is_active).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════ PERFORMANCE TAB ═══════ */}
          <TabsContent value="performance" className="space-y-6">
            {loadingPerf && !perfMetrics ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : perfMetrics ? (
              <>
                {/* SLO Score */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle icon={MonitorCheck} title="Saúde do Sistema — SLO Compliance" />
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleAutoHeal} disabled={runningHeal} className="h-8 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
                        <Zap className={cn("h-3 w-3 mr-1", runningHeal && "animate-pulse")} /> Auto-Heal
                      </Button>
                      <Button size="sm" variant="outline" onClick={fetchPerfMetrics} disabled={loadingPerf} className="h-8 text-xs">
                        <RefreshCw className={cn("h-3 w-3 mr-1", loadingPerf && "animate-spin")} /> Re-benchmark
                      </Button>
                    </div>
                  </div>
                  <div className="card-surface p-5">
                    {/* Main Score */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="relative">
                        <div className={cn("text-5xl font-black tabular-nums", perfMetrics.sloScore >= 95 ? "text-emerald-500" : perfMetrics.sloScore >= 80 ? "text-amber-500" : "text-destructive")}>
                          {perfMetrics.sloScore}%
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center">Meta: 95%</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">Saúde Geral do Sistema</p>
                        <p className="text-[11px] text-muted-foreground">
                          {perfMetrics.slos.filter((s) => s.met).length}/{perfMetrics.slos.length} objetivos atingidos
                        </p>
                        <Progress value={perfMetrics.sloScore} className="h-2 mt-2 [&>div]:transition-all [&>div]:duration-700" />
                        <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                          <Settings2 className="h-2.5 w-2.5" /> Auto-heal ativo a cada 30min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Benchmark em</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{perfMetrics.executionTime}ms</p>
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    {perfMetrics.sloByCategory && (
                      <div className="grid grid-cols-5 gap-2 mb-5">
                        {perfMetrics.sloByCategory.map((cat) => {
                          const catLabels: Record<string, string> = {
                            performance: "Performance", reliability: "Confiabilidade",
                            content: "Conteúdo", ux: "Experiência", data: "Dados"
                          };
                          const catIcons: Record<string, typeof Zap> = {
                            performance: Zap, reliability: ShieldCheck,
                            content: BookOpen, ux: Globe, data: HardDrive
                          };
                          const CatIcon = catIcons[cat.category] || Layers;
                          return (
                            <div key={cat.category} className={cn(
                              "rounded-lg border p-2.5 text-center transition-colors",
                              cat.score === 100 ? "border-emerald-500/30 bg-emerald-500/5" :
                              cat.score >= 75 ? "border-amber-500/30 bg-amber-500/5" :
                              "border-destructive/30 bg-destructive/5"
                            )}>
                              <CatIcon className={cn("h-4 w-4 mx-auto mb-1",
                                cat.score === 100 ? "text-emerald-500" : cat.score >= 75 ? "text-amber-500" : "text-destructive"
                              )} />
                              <p className={cn("text-lg font-black tabular-nums",
                                cat.score === 100 ? "text-emerald-500" : cat.score >= 75 ? "text-amber-500" : "text-destructive"
                              )}>{cat.score}%</p>
                              <p className="text-[9px] text-muted-foreground">{catLabels[cat.category]}</p>
                              <p className="text-[8px] text-muted-foreground/60">{cat.met}/{cat.total}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Detailed SLOs grouped by category */}
                    <div className="space-y-4">
                      {["performance", "reliability", "content", "ux", "data"].map((cat) => {
                        const catSlos = perfMetrics.slos.filter((s) => s.category === cat);
                        if (catSlos.length === 0) return null;
                        const catLabels: Record<string, string> = {
                          performance: "⚡ Performance", reliability: "🛡️ Confiabilidade",
                          content: "📚 Conteúdo", ux: "🎯 Experiência do Usuário", data: "💾 Dados & Escala"
                        };
                        return (
                          <div key={cat}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{catLabels[cat]}</p>
                            <div className="space-y-1">
                              {catSlos.map((slo) => (
                                <div key={slo.name} className="flex items-center gap-3 py-0.5">
                                  {slo.met
                                    ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                    : <CircleX className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                  <span className="text-xs text-foreground flex-1">{slo.name}</span>
                                  <span className={cn("text-xs font-bold tabular-nums", slo.met ? "text-emerald-500" : "text-destructive")}>
                                    {typeof slo.actual === 'number' && slo.actual % 1 !== 0 ? slo.actual.toFixed(1) : slo.actual}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground w-14 text-right">meta: {slo.target}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Response Times Chart */}
                <section>
                  <SectionTitle icon={Timer} title="Tempos de Resposta — Queries Críticas" />
                  <div className="card-surface p-4">
                    <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                      <div>
                        <p className={cn("text-2xl font-black tabular-nums", perfMetrics.responseTimeSummary.avg < 100 ? "text-emerald-500" : perfMetrics.responseTimeSummary.avg < 200 ? "text-amber-500" : "text-destructive")}>
                          {perfMetrics.responseTimeSummary.avg}ms
                        </p>
                        <p className="text-[10px] text-muted-foreground">Média</p>
                      </div>
                      <div>
                        <p className={cn("text-2xl font-black tabular-nums", perfMetrics.responseTimeSummary.p95 < 300 ? "text-emerald-500" : perfMetrics.responseTimeSummary.p95 < 500 ? "text-amber-500" : "text-destructive")}>
                          {perfMetrics.responseTimeSummary.p95}ms
                        </p>
                        <p className="text-[10px] text-muted-foreground">P95</p>
                      </div>
                      <div>
                        <p className={cn("text-2xl font-black tabular-nums", perfMetrics.responseTimeSummary.max < 500 ? "text-emerald-500" : "text-destructive")}>
                          {perfMetrics.responseTimeSummary.max}ms
                        </p>
                        <p className="text-[10px] text-muted-foreground">Máximo</p>
                      </div>
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={perfMetrics.queryBenchmarks} layout="vertical" margin={{ left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="ms" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={95} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(value: number) => [`${value}ms`, "Tempo"]}
                          />
                          <Bar dataKey="ms" name="Response Time" radius={[0, 4, 4, 0]}>
                            {perfMetrics.queryBenchmarks.map((entry, i) => (
                              <Cell key={i} fill={entry.ms < 100 ? "hsl(var(--chart-2))" : entry.ms < 200 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-2))]" /> &lt;100ms Bom</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-4))]" /> 100-200ms Ok</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> &gt;200ms Lento</span>
                    </div>
                  </div>
                </section>

                {/* Reliability + Throughput */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section>
                    <SectionTitle icon={ShieldCheck} title="Confiabilidade" />
                    <div className="card-surface p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className={cn("text-3xl font-black tabular-nums", perfMetrics.reliability.uptimeProxy >= 99 ? "text-emerald-500" : "text-amber-500")}>
                            {perfMetrics.reliability.uptimeProxy.toFixed(2)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">Uptime Proxy (24h)</p>
                        </div>
                        <div>
                          <p className={cn("text-3xl font-black tabular-nums", perfMetrics.reliability.errorRate < 1 ? "text-emerald-500" : "text-destructive")}>
                            {perfMetrics.reliability.errorRate}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">Taxa de Erro (24h)</p>
                        </div>
                      </div>
                      <div className="text-center text-[11px] text-muted-foreground">
                        {perfMetrics.reliability.errorCount} erros em {perfMetrics.reliability.totalActions} ações registradas
                      </div>
                    </div>
                  </section>

                  <section>
                    <SectionTitle icon={Zap} title="Throughput (Última Hora)" />
                    <div className="card-surface p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-black text-foreground">{perfMetrics.throughput.lessonProgressPerHour}</p>
                          <p className="text-[10px] text-muted-foreground">Progressos de aula</p>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-foreground">{perfMetrics.throughput.quizAttemptsPerHour}</p>
                          <p className="text-[10px] text-muted-foreground">Tentativas de quiz</p>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-foreground">{perfMetrics.throughput.enrollmentsPerHour}</p>
                          <p className="text-[10px] text-muted-foreground">Matrículas</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* LMS Health SLIs */}
                <section>
                  <SectionTitle icon={Layers} title="Saúde do Conteúdo LMS" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiGauge icon={Video} label="Disponibilidade de Vídeo" value={perfMetrics.lmsHealth.videoAvailability}
                      target={80} color="text-blue-500" />
                    <KpiGauge icon={BookOpen} label="Completude de Conteúdo" value={perfMetrics.lmsHealth.contentCompleteness}
                      target={90} color="text-emerald-500" />
                    <KpiGauge icon={Trophy} label="Cobertura de Quizzes" value={perfMetrics.lmsHealth.quizCoverage}
                      target={50} color="text-amber-500" />
                  </div>
                </section>

                {/* Data Volume / Capacity */}
                <section>
                  <SectionTitle icon={HardDrive} title="Volume de Dados (Capacity Planning)" />
                  <div className="card-surface p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                      {Object.entries(perfMetrics.dataVolume).map(([key, value]) => {
                        const labels: Record<string, string> = {
                          profiles: "Perfis", enrollments: "Matrículas", lessonProgress: "Progresso",
                          quizAttempts: "Quiz Attempts", forumPosts: "Posts Fórum", notifications: "Notificações",
                        };
                        return (
                          <div key={key}>
                            <p className="text-xl font-black tabular-nums text-foreground">
                              {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{labels[key] || key}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* ─── HISTORICAL TRENDS ─── */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle icon={TrendingUp} title="Tendência Histórica" />
                    <div className="flex items-center gap-2">
                      {(["24h", "7d", "30d"] as const).map((r) => (
                        <Button key={r} size="sm" variant={snapshotRange === r ? "default" : "outline"}
                          className="h-7 text-[11px] px-2.5"
                          onClick={() => { setSnapshotRange(r); fetchSnapshots(r); }}>
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {loadingSnapshots ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                    </div>
                  ) : snapshots.length === 0 ? (
                    <div className="card-surface p-8 text-center text-muted-foreground text-sm">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum snapshot encontrado para o período selecionado.</p>
                      <p className="text-[11px] mt-1">Os snapshots são coletados automaticamente a cada hora.</p>
                      <Button size="sm" variant="outline" className="mt-3 h-8 text-xs"
                        onClick={async () => {
                          setLoadingPerf(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("performance-snapshot");
                            if (error) throw error;
                            toast.success("Snapshot salvo! Atualizando...");
                            setPerfMetrics(data as PerformanceMetrics);
                            fetchSnapshots(snapshotRange);
                          } catch (e: any) { toast.error(e.message); }
                          finally { setLoadingPerf(false); }
                        }}>
                        <Play className="h-3 w-3 mr-1" /> Capturar snapshot agora
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Response Time Trend */}
                      <div className="card-surface p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                          Tempo de Resposta (ms)
                        </p>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={snapshots.map((s: any) => ({
                              time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                              avg: Number(s.avg_response_ms),
                              p95: Number(s.p95_response_ms),
                              max: Number(s.max_response_ms),
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="ms" />
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                              <Area type="monotone" dataKey="max" name="Máximo" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} />
                              <Area type="monotone" dataKey="p95" name="P95" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.15} />
                              <Area type="monotone" dataKey="avg" name="Média" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* SLO Score + Uptime Trend */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card-surface p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            SLO Score (%)
                          </p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                slo: s.slo_score,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="slo" name="SLO Score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="card-surface p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Uptime & Taxa de Erro (%)
                          </p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                uptime: Number(s.uptime_proxy),
                                errors: Number(s.error_rate),
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="uptime" name="Uptime" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
                                <Area type="monotone" dataKey="errors" name="Erros" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Users Online + Throughput Trend */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card-surface p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Usuários Online & Ativos
                          </p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                online: s.users_online,
                                ativos: s.active_today,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="ativos" name="Ativos hoje" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="online" name="Online" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="card-surface p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Throughput / Hora
                          </p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                aulas: s.throughput_lessons_hour,
                                quizzes: s.throughput_quizzes_hour,
                                matriculas: s.throughput_enrollments_hour,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Bar dataKey="aulas" name="Aulas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="quizzes" name="Quizzes" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="matriculas" name="Matrículas" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-[10px] text-muted-foreground">
                        {snapshots.length} snapshot(s) no período · Coleta automática a cada hora
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="card-surface p-12 text-center">
                <Timer className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Clique em "Performance" para executar o benchmark</p>
              </div>
            )}
          </TabsContent>

          {/* ═══════ OPERATIONS TAB ═══════ */}
          <TabsContent value="operations" className="space-y-6">
            {m && (
              <>
                <section>
                  <SectionTitle icon={Server} title="Operações Pendentes" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Clock} label="Treinamentos pendentes" value={m.operations.trainingRequestsPending}
                      color={m.operations.trainingRequestsPending > 5 ? "text-amber-500" : "text-emerald-500"} />
                    <StatCard icon={Gift} label="Resgates pendentes" value={m.operations.rewardRedemptionsPending}
                      color={m.operations.rewardRedemptionsPending > 3 ? "text-amber-500" : "text-emerald-500"} />
                    <StatCard icon={Bell} label="Notificações não lidas" value={m.operations.notificationsUnread} color="text-blue-500" />
                    <StatCard icon={UserPlus} label="Novos usuários hoje" value={m.users.newToday}
                      delta={m.users.newWeek} deltaLabel="semana" color="text-cyan-500" />
                  </div>
                </section>

                {m.users.companies.length > 0 && (
                  <section>
                    <SectionTitle icon={Globe} title="Distribuição por Empresa" />
                    <div className="card-surface p-4 space-y-2">
                      {m.users.companies.slice(0, 10).map((c) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground min-w-[120px] truncate">{c.name}</span>
                          <div className="flex-1"><Progress value={Math.round((c.count / m.users.total) * 100)} className="h-1.5" /></div>
                          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {m.recentAuditLogs.length > 0 && (
                  <section>
                    <SectionTitle icon={FileText} title="Últimos Logs de Auditoria" />
                    <div className="card-surface overflow-hidden divide-y divide-border">
                      {m.recentAuditLogs.map((log) => (
                        <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                          <Badge variant="outline" className="text-[10px] shrink-0">{log.entity_type}</Badge>
                          <span className="text-foreground font-medium truncate flex-1">{log.action}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {new Date(log.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══════ ALERTS TAB ═══════ */}
          <TabsContent value="alerts" className="space-y-6">
            <section>
              <SectionTitle icon={Settings2} title="Nova Regra de Alerta" />
              <div className="card-surface p-4">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Métrica</label>
                    <Select value={newMetricKey} onValueChange={setNewMetricKey}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {METRIC_OPTIONS.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Operador</label>
                    <Select value={newOperator} onValueChange={setNewOperator}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gte">≥ Maior ou igual</SelectItem>
                        <SelectItem value="lte">≤ Menor ou igual</SelectItem>
                        <SelectItem value="eq">= Igual a</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Limite</label>
                    <Input type="number" placeholder="Ex: 10" value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cooldown (min)</label>
                    <div className="flex gap-2">
                      <Input type="number" value={newCooldown}
                        onChange={(e) => setNewCooldown(e.target.value)} className="h-9 text-sm" />
                      <Button size="sm" onClick={handleAddRule} disabled={!newMetricKey || !newThreshold}
                        className="h-9 px-3 shrink-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle icon={AlertTriangle} title={`Regras Ativas (${alertRules.length})`} />
                <Button size="sm" variant="outline" onClick={handleCheckAlerts} disabled={checkingAlerts} className="h-8 text-xs">
                  <Play className={cn("h-3 w-3 mr-1", checkingAlerts && "animate-spin")} /> Verificar agora
                </Button>
              </div>
              {loadingAlerts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                </div>
              ) : alertRules.length === 0 ? (
                <div className="card-surface p-8 text-center text-muted-foreground text-sm">
                  Nenhuma regra configurada. Crie uma acima para começar.
                </div>
              ) : (
                <div className="card-surface overflow-hidden divide-y divide-border">
                  {alertRules.map((rule) => {
                    const metricOpt = METRIC_OPTIONS.find((m) => m.key === rule.metric_key);
                    const RIcon = metricOpt?.icon || AlertTriangle;
                    return (
                      <div key={rule.id} className={cn("px-4 py-3 flex items-center gap-3", !rule.is_active && "opacity-50")}>
                        <RIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{rule.metric_label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {OPERATOR_LABELS[rule.operator]} {rule.threshold} · Cooldown: {rule.cooldown_minutes}min
                          </p>
                        </div>
                        <Switch checked={rule.is_active} onCheckedChange={(v) => handleToggleRule(rule.id, v)} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon={History} title={`Histórico de Alertas (${alertHistory.length})`} />
              {alertHistory.length === 0 ? (
                <div className="card-surface p-8 text-center text-muted-foreground text-sm">
                  Nenhum alerta disparado ainda.
                </div>
              ) : (
                <div className="card-surface overflow-hidden divide-y divide-border">
                  {alertHistory.map((entry) => {
                    const rule = alertRules.find((r) => r.id === entry.rule_id);
                    return (
                      <div key={entry.id} className="px-4 py-2.5 flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {rule?.metric_label || entry.metric_key}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Valor: <span className="font-bold text-foreground">{entry.metric_value}</span> · Limite: {entry.threshold}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {new Date(entry.triggered_at).toLocaleString("pt-BR", {
                            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMonitoramento;
