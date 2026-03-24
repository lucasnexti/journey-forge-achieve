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

  const fetchPerfMetrics = useCallback(async (autoHealOnFail = false) => {
    setLoadingPerf(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("performance-metrics");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const pm = data as PerformanceMetrics;
      setPerfMetrics(pm);

      // Auto-trigger heal if SLO score is below target and content SLOs are failing
      if (autoHealOnFail && pm.sloScore < 95) {
        const contentFailing = pm.slos.filter(s => !s.met && ["content", "ux"].includes(s.category));
        if (contentFailing.length > 0) {
          toast.info("🔄 Indicadores negativos detectados. Executando correção automática...");
          try {
            const { data: healData } = await supabase.functions.invoke("auto-heal");
            if (healData?.fixed > 0) {
              toast.success(`✅ ${healData.fixed} correção(ões) automática(s) aplicada(s)!`);
              // Re-fetch to show updated scores
              const { data: refreshed } = await supabase.functions.invoke("performance-metrics");
              if (refreshed && !refreshed.error) setPerfMetrics(refreshed as PerformanceMetrics);
            }
            if (healData?.alerts > 0) {
              toast.warning(`⚠️ ${healData.alerts} item(ns) precisam de atenção manual.`);
            }
          } catch { /* heal is best-effort */ }
        }
      }
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
            <TabsTrigger value="performance" className="text-xs gap-1.5" onClick={() => { if (!perfMetrics && !loadingPerf) { fetchPerfMetrics(true); fetchSnapshots(snapshotRange); } }}>
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
                {/* ═══ TOP ROW: Health Score + Quick Stats ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Main Health Score Card */}
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-4 card-surface p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative mb-3">
                        <svg viewBox="0 0 120 120" className="w-28 h-28">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                          <circle cx="60" cy="60" r="52" fill="none"
                            stroke={perfMetrics.sloScore >= 95 ? "hsl(142, 76%, 36%)" : perfMetrics.sloScore >= 80 ? "hsl(38, 92%, 50%)" : "hsl(var(--destructive))"}
                            strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${(perfMetrics.sloScore / 100) * 327} 327`}
                            transform="rotate(-90 60 60)"
                            className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn("text-3xl font-black tabular-nums",
                            perfMetrics.sloScore >= 95 ? "text-emerald-500" : perfMetrics.sloScore >= 80 ? "text-amber-500" : "text-destructive"
                          )}>{perfMetrics.sloScore}%</span>
                          <span className="text-[9px] text-muted-foreground font-medium">SAÚDE</span>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-foreground">SLO Compliance</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {perfMetrics.slos.filter((s) => s.met).length}/{perfMetrics.slos.length} objetivos · Meta: 95%
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={handleAutoHeal} disabled={runningHeal}
                          className="h-7 text-[10px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
                          <Zap className={cn("h-3 w-3 mr-1", runningHeal && "animate-pulse")} /> Auto-Heal
                        </Button>
                        <Button size="sm" variant="outline" onClick={fetchPerfMetrics} disabled={loadingPerf} className="h-7 text-[10px]">
                          <RefreshCw className={cn("h-3 w-3 mr-1", loadingPerf && "animate-spin")} /> Benchmark
                        </Button>
                      </div>
                      <p className="text-[8px] text-muted-foreground/50 mt-2 flex items-center gap-1">
                        <Settings2 className="h-2 w-2" /> Auto-heal ativo a cada 30min · {perfMetrics.executionTime}ms
                      </p>
                    </div>
                  </motion.div>

                  {/* Quick Performance Cards */}
                  <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Avg Response */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg",
                          perfMetrics.responseTimeSummary.avg < 500 ? "bg-emerald-500/10 text-emerald-500" :
                          perfMetrics.responseTimeSummary.avg < 1000 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"
                        )}>
                          <Gauge className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] h-5",
                          perfMetrics.responseTimeSummary.avg < 500 ? "border-emerald-500/30 text-emerald-600" :
                          perfMetrics.responseTimeSummary.avg < 1000 ? "border-amber-500/30 text-amber-600" : "border-destructive/30 text-destructive"
                        )}>
                          {perfMetrics.responseTimeSummary.avg < 500 ? "Ótimo" : perfMetrics.responseTimeSummary.avg < 1000 ? "Bom" : "Lento"}
                        </Badge>
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.responseTimeSummary.avg}<span className="text-sm font-medium text-muted-foreground">ms</span></p>
                      <p className="text-[10px] text-muted-foreground">Tempo Médio</p>
                    </motion.div>

                    {/* P95 Response */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg",
                          perfMetrics.responseTimeSummary.p95 < 800 ? "bg-emerald-500/10 text-emerald-500" :
                          perfMetrics.responseTimeSummary.p95 < 1500 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"
                        )}>
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] text-muted-foreground">P95</span>
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.responseTimeSummary.p95}<span className="text-sm font-medium text-muted-foreground">ms</span></p>
                      <p className="text-[10px] text-muted-foreground">Percentil 95</p>
                    </motion.div>

                    {/* Uptime */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg",
                          perfMetrics.reliability.uptimeProxy >= 99 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse",
                          perfMetrics.reliability.uptimeProxy >= 99 ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.reliability.uptimeProxy.toFixed(1)}<span className="text-sm font-medium text-muted-foreground">%</span></p>
                      <p className="text-[10px] text-muted-foreground">Uptime (24h)</p>
                    </motion.div>

                    {/* Error Rate */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg",
                          perfMetrics.reliability.errorRate < 1 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                        )}>
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{perfMetrics.reliability.errorCount} erros</span>
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.reliability.errorRate}<span className="text-sm font-medium text-muted-foreground">%</span></p>
                      <p className="text-[10px] text-muted-foreground">Taxa de Erro</p>
                    </motion.div>

                    {/* Throughput Cards */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.throughput.lessonProgressPerHour}</p>
                      <p className="text-[10px] text-muted-foreground">Aulas/hora</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-4/10 text-[hsl(var(--chart-4))]">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.throughput.quizAttemptsPerHour}</p>
                      <p className="text-[10px] text-muted-foreground">Quizzes/hora</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.throughput.enrollmentsPerHour}</p>
                      <p className="text-[10px] text-muted-foreground">Matrículas/hora</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                      className="card-surface p-4 space-y-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Timer className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black tabular-nums text-foreground">{perfMetrics.executionTime}<span className="text-sm font-medium text-muted-foreground">ms</span></p>
                      <p className="text-[10px] text-muted-foreground">Benchmark Total</p>
                    </motion.div>
                  </div>
                </div>

                {/* ═══ SLO CATEGORY BREAKDOWN ═══ */}
                {perfMetrics.sloByCategory && (
                  <section>
                    <SectionTitle icon={MonitorCheck} title="Conformidade por Categoria" />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {perfMetrics.sloByCategory.map((cat) => {
                        const catConfig: Record<string, { label: string; icon: typeof Zap; gradient: string }> = {
                          performance: { label: "Performance", icon: Zap, gradient: "from-blue-500/20 to-cyan-500/10" },
                          reliability: { label: "Confiabilidade", icon: ShieldCheck, gradient: "from-emerald-500/20 to-green-500/10" },
                          content: { label: "Conteúdo", icon: BookOpen, gradient: "from-purple-500/20 to-violet-500/10" },
                          ux: { label: "Experiência", icon: Eye, gradient: "from-amber-500/20 to-orange-500/10" },
                          data: { label: "Dados", icon: Database, gradient: "from-slate-500/20 to-gray-500/10" },
                        };
                        const cfg = catConfig[cat.category] || { label: cat.category, icon: Layers, gradient: "from-muted/50 to-muted/20" };
                        const CatIcon = cfg.icon;
                        const isGreen = cat.score === 100;
                        const isWarn = cat.score >= 50 && cat.score < 100;
                        const isRed = cat.score < 50;
                        return (
                          <motion.div key={cat.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className={cn("card-surface p-4 relative overflow-hidden group hover:shadow-md transition-shadow")}>
                            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", cfg.gradient)} />
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-3">
                                <CatIcon className={cn("h-5 w-5",
                                  isGreen ? "text-emerald-500" : isWarn ? "text-amber-500" : "text-destructive"
                                )} />
                                <Badge variant="outline" className={cn("text-[9px] h-5",
                                  isGreen ? "border-emerald-500/30 text-emerald-600" :
                                  isWarn ? "border-amber-500/30 text-amber-600" : "border-destructive/30 text-destructive"
                                )}>
                                  {cat.met}/{cat.total}
                                </Badge>
                              </div>
                              <p className={cn("text-2xl font-black tabular-nums",
                                isGreen ? "text-emerald-500" : isWarn ? "text-amber-500" : "text-destructive"
                              )}>{cat.score}%</p>
                              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{cfg.label}</p>
                              <Progress value={cat.score} className={cn("h-1 mt-2",
                                isGreen ? "[&>div]:bg-emerald-500" : isWarn ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"
                              )} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* ═══ QUERY BENCHMARKS CHART ═══ */}
                <section>
                  <SectionTitle icon={Timer} title="Benchmark — Queries Críticas" />
                  <div className="card-surface p-4">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...perfMetrics.queryBenchmarks].sort((a, b) => b.ms - a.ms)} layout="vertical" margin={{ left: 110, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="ms" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={105} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(value: number) => [`${value}ms`, "Tempo"]}
                            labelFormatter={(label) => `Query: ${label}`}
                          />
                          <Bar dataKey="ms" name="Response Time" radius={[0, 6, 6, 0]} barSize={18}>
                            {[...perfMetrics.queryBenchmarks].sort((a, b) => b.ms - a.ms).map((entry, i) => (
                              <Cell key={i} fill={entry.ms < 500 ? "hsl(142, 76%, 36%)" : entry.ms < 800 ? "hsl(var(--chart-2))" : entry.ms < 1000 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(142, 76%, 36%)" }} /> &lt;500ms Ótimo</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-2))]" /> 500-800ms Bom</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-4))]" /> 800-1000ms Ok</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> &gt;1000ms Lento</span>
                    </div>
                  </div>
                </section>

                {/* ═══ LMS HEALTH + DATA VOLUME ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LMS Health */}
                  <section>
                    <SectionTitle icon={Layers} title="Saúde do Conteúdo LMS" />
                    <div className="card-surface p-4 space-y-4">
                      {[
                        { label: "Disponibilidade de Vídeo", value: perfMetrics.lmsHealth.videoAvailability, target: 80, icon: Video, color: "bg-blue-500" },
                        { label: "Completude de Conteúdo", value: perfMetrics.lmsHealth.contentCompleteness, target: 90, icon: BookOpen, color: "bg-emerald-500" },
                        { label: "Cobertura de Quizzes", value: perfMetrics.lmsHealth.quizCoverage, target: 50, icon: Trophy, color: "bg-amber-500" },
                        { label: "Taxa de Aprovação Quiz", value: perfMetrics.lmsHealth.quizPassRate ?? 100, target: 60, icon: Award, color: "bg-purple-500" },
                        { label: "Perfis Completos", value: perfMetrics.lmsHealth.profileCompleteness ?? 100, target: 50, icon: Globe, color: "bg-cyan-500" },
                        { label: "Descrição em Aulas", value: perfMetrics.lmsHealth.lessonDescCoverage ?? 100, target: 70, icon: FileText, color: "bg-indigo-500" },
                      ].map((item) => {
                        const met = item.value >= item.target;
                        return (
                          <div key={item.label} className="flex items-center gap-3">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-md shrink-0", item.color + "/10")}>
                              <item.icon className={cn("h-3.5 w-3.5", item.color.replace("bg-", "text-"))} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[11px] text-foreground font-medium truncate">{item.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("text-xs font-black tabular-nums", met ? "text-emerald-500" : "text-destructive")}>
                                    {item.value}%
                                  </span>
                                  {met ? <CircleCheck className="h-3 w-3 text-emerald-500" /> : <CircleX className="h-3 w-3 text-destructive" />}
                                </div>
                              </div>
                              <div className="relative">
                                <Progress value={item.value} className={cn("h-1.5",
                                  met ? "[&>div]:bg-emerald-500" : "[&>div]:bg-destructive"
                                )} />
                                <div className="absolute top-0 h-full border-l border-dashed border-muted-foreground/30"
                                  style={{ left: `${item.target}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Data Volume */}
                  <section>
                    <SectionTitle icon={HardDrive} title="Volume de Dados" />
                    <div className="card-surface p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(perfMetrics.dataVolume).map(([key, value]) => {
                          const config: Record<string, { label: string; icon: typeof Database; color: string }> = {
                            profiles: { label: "Perfis", icon: Globe, color: "text-blue-500 bg-blue-500/10" },
                            enrollments: { label: "Matrículas", icon: GraduationCap, color: "text-emerald-500 bg-emerald-500/10" },
                            lessonProgress: { label: "Progresso", icon: TrendingUp, color: "text-purple-500 bg-purple-500/10" },
                            quizAttempts: { label: "Quiz Attempts", icon: Award, color: "text-amber-500 bg-amber-500/10" },
                            forumPosts: { label: "Posts Fórum", icon: MessageSquare, color: "text-cyan-500 bg-cyan-500/10" },
                            notifications: { label: "Notificações", icon: Bell, color: "text-pink-500 bg-pink-500/10" },
                          };
                          const cfg = config[key] || { label: key, icon: Database, color: "text-muted-foreground bg-muted" };
                          const ItemIcon = cfg.icon;
                          const colors = cfg.color.split(" ");
                          return (
                            <div key={key} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", colors[1])}>
                                <ItemIcon className={cn("h-4 w-4", colors[0])} />
                              </div>
                              <div>
                                <p className="text-lg font-black tabular-nums text-foreground leading-tight">
                                  {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </div>

                {/* ═══ DETAILED SLOs ═══ */}
                <section>
                  <SectionTitle icon={CheckCircle2} title="Detalhamento dos SLOs" />
                  <div className="card-surface overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                      {perfMetrics.slos.map((slo, i) => (
                        <motion.div key={slo.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className={cn("p-3 bg-card flex items-center gap-3",
                            slo.met ? "hover:bg-emerald-500/5" : "hover:bg-destructive/5"
                          )}>
                          {slo.met
                            ? <CircleCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <CircleX className="h-4 w-4 text-destructive shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-foreground font-medium truncate">{slo.name}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {slo.category} · meta: {slo.target}
                            </p>
                          </div>
                          <span className={cn("text-xs font-bold tabular-nums shrink-0",
                            slo.met ? "text-emerald-500" : "text-destructive"
                          )}>
                            {typeof slo.actual === 'number' && slo.actual % 1 !== 0 ? slo.actual.toFixed(1) : slo.actual}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ═══ HISTORICAL TRENDS ═══ */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle icon={TrendingUp} title="Tendência Histórica" />
                    <div className="flex items-center gap-1.5">
                      {(["24h", "7d", "30d"] as const).map((r) => (
                        <Button key={r} size="sm" variant={snapshotRange === r ? "default" : "ghost"}
                          className="h-7 text-[10px] px-2.5"
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
                      <p>Nenhum snapshot encontrado para o período.</p>
                      <p className="text-[11px] mt-1">Snapshots são coletados automaticamente a cada hora.</p>
                      <Button size="sm" variant="outline" className="mt-3 h-8 text-xs"
                        onClick={async () => {
                          setLoadingPerf(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("performance-snapshot");
                            if (error) throw error;
                            toast.success("Snapshot salvo!");
                            setPerfMetrics(data as PerformanceMetrics);
                            fetchSnapshots(snapshotRange);
                          } catch (e: any) { toast.error(e.message); }
                          finally { setLoadingPerf(false); }
                        }}>
                        <Play className="h-3 w-3 mr-1" /> Capturar agora
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Response Time + SLO in 2-col */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card-surface p-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tempo de Resposta</p>
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                avg: Number(s.avg_response_ms), p95: Number(s.p95_response_ms), max: Number(s.max_response_ms),
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="ms" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="max" name="Máximo" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.08} />
                                <Area type="monotone" dataKey="p95" name="P95" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.12} />
                                <Area type="monotone" dataKey="avg" name="Média" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="card-surface p-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">SLO Score</p>
                          <div className="h-44">
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
                      </div>

                      {/* Uptime + Throughput */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card-surface p-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Uptime & Erros</p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                uptime: Number(s.uptime_proxy), errors: Number(s.error_rate),
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

                        <div className="card-surface p-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Throughput/Hora</p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={snapshots.map((s: any) => ({
                                time: new Date(s.captured_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                                aulas: s.throughput_lessons_hour, quizzes: s.throughput_quizzes_hour, matriculas: s.throughput_enrollments_hour,
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

                      <p className="text-center text-[10px] text-muted-foreground">
                        {snapshots.length} snapshot(s) · Coleta automática a cada hora
                      </p>
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
