import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import {
  Activity, Users, Wifi, Globe, BookOpen, GraduationCap, Trophy,
  MessageSquare, Coins, Award, ShieldCheck, Bell, Gift, Clock,
  RefreshCw, Server, Database, Zap, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, BarChart3, FileText, Plus, Trash2, Play, History,
  Settings2, Target, Percent, Flame, UserPlus, ArrowUpRight, ArrowDownRight,
  Gauge, Eye, CalendarDays, PieChart,
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
  PieChart as RPieChart, Pie, Cell, RadialBarChart, RadialBar,
  AreaChart, Area, CartesianGrid,
} from "recharts";

/* ─── Types ─── */
interface SystemMetrics {
  timestamp: string;
  users: {
    total: number;
    onlineNow: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    companies: { name: string; count: number }[];
  };
  content: { tracksTotal: number; tracksActive: number; lessonsTotal: number };
  engagement: {
    enrollmentsTotal: number; enrollmentsToday: number; enrollmentsWeek: number;
    enrollmentsMonth: number; enrollmentsCompleted: number;
    lessonsCompletedToday: number; lessonsCompletedWeek: number;
    quizAttemptsToday: number; quizAttemptsWeek: number; quizPassedWeek: number;
    quizAttemptsTotal: number; quizPassedTotal: number;
    forumPostsToday: number; forumPostsWeek: number;
    coinTransactionsToday: number;
    badgesEarnedToday: number; badgesEarnedWeek: number;
  };
  operations: {
    certificatesTotal: number; certificatesToday: number; certificatesWeek: number;
    trainingRequestsPending: number; trainingRequestsTotal: number;
    rewardRedemptionsPending: number; notificationsUnread: number;
  };
  kpis: {
    dauMauRatio: number; completionRate: number; quizPassRate: number;
    retentionRate7d: number; retentionRate30d: number; growthRateWeek: number;
    avgStreak: number; maxStreak: number; activeStreaks: number;
  };
  activityByDay: { day: string; count: number }[];
  recentAuditLogs: { id: string; action: string; entity_type: string; created_at: string }[];
}

interface AlertRule {
  id: string; metric_key: string; metric_label: string; operator: string;
  threshold: number; is_active: boolean; cooldown_minutes: number; created_at: string;
}

interface AlertHistoryEntry {
  id: string; metric_key: string; metric_value: number; threshold: number;
  triggered_at: string; rule_id: string;
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
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

/* ─── Subcomponents ─── */
const KpiGauge = ({ value, label, target, suffix = "%", icon: Icon, color = "text-primary" }: {
  value: number; label: string; target?: number; suffix?: string;
  icon: React.ElementType; color?: string;
}) => {
  const status = target ? (value >= target ? "good" : value >= target * 0.7 ? "warn" : "bad") : "good";
  const statusColor = status === "good" ? "text-emerald-500" : status === "warn" ? "text-amber-500" : "text-destructive";
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="card-surface p-4 flex flex-col items-center text-center gap-2">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative w-full max-w-[100px] mx-auto">
        <Progress value={Math.min(value, 100)} className="h-2 [&>div]:transition-all [&>div]:duration-700" />
      </div>
      <p className={cn("text-2xl font-black tabular-nums", statusColor)}>{value}{suffix}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      {target && (
        <p className="text-[9px] text-muted-foreground/60">Meta: {target}{suffix}</p>
      )}
    </motion.div>
  );
};

const StatCard = ({
  icon: Icon, label, value, delta, deltaLabel, color = "text-primary",
}: {
  icon: React.ElementType; label: string; value: string | number;
  delta?: number; deltaLabel?: string; color?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="card-surface p-4 flex items-start gap-3">
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted", color)}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground leading-tight mb-0.5">{label}</p>
      <p className="text-xl font-extrabold tabular-nums text-foreground">{value}</p>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-0.5">
          {delta >= 0
            ? <ArrowUpRight className="h-3 w-3 text-emerald-500" />
            : <ArrowDownRight className="h-3 w-3 text-destructive" />}
          <span className={cn("text-[10px] font-medium", delta >= 0 ? "text-emerald-500" : "text-destructive")}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
          {deltaLabel && <span className="text-[10px] text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </div>
  </motion.div>
);

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</h2>
  </div>
);

/* ─── FUNNEL CHART ─── */
const FunnelStep = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{label}</span>
      <div className="flex-1 relative">
        <div className="h-7 rounded bg-muted overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full rounded", color)} />
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums w-14 text-right">{value}</span>
      <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
    </div>
  );
};

/* ─── MAIN COMPONENT ─── */
const AdminMonitoramento = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superLoading } = useIsSuperAdmin();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Alert state
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [newMetricKey, setNewMetricKey] = useState("");
  const [newOperator, setNewOperator] = useState("gte");
  const [newThreshold, setNewThreshold] = useState("");
  const [newCooldown, setNewCooldown] = useState("60");

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

  useEffect(() => {
    if (isSuperAdmin) { fetchMetrics(); fetchAlertData(); }
  }, [isSuperAdmin, fetchMetrics, fetchAlertData]);

  useEffect(() => {
    if (!autoRefresh || !isSuperAdmin) return;
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, isSuperAdmin, fetchMetrics]);

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
  const kpis = m?.kpis;

  // SRE-style composite health score
  const healthScore = m
    ? Math.min(100, Math.round(
        (m.users.onlineNow > 0 ? 20 : 0) +
        (kpis!.retentionRate7d >= 30 ? 20 : kpis!.retentionRate7d >= 15 ? 10 : 0) +
        (kpis!.completionRate >= 20 ? 20 : kpis!.completionRate >= 10 ? 10 : 0) +
        (m.operations.trainingRequestsPending < 10 ? 20 : m.operations.trainingRequestsPending < 20 ? 10 : 0) +
        (kpis!.dauMauRatio >= 10 ? 20 : kpis!.dauMauRatio >= 5 ? 10 : 0)
      ))
    : 0;

  const healthColor = healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-destructive";
  const healthBg = healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-destructive";
  const healthLabel = healthScore >= 80 ? "Saudável" : healthScore >= 50 ? "Atenção" : "Crítico";

  // Funnel data
  const funnelData = m ? [
    { label: "Cadastrados", value: m.users.total, color: "bg-blue-500" },
    { label: "Matriculados", value: m.engagement.enrollmentsTotal, color: "bg-violet-500" },
    { label: "Concluíram", value: m.engagement.enrollmentsCompleted, color: "bg-emerald-500" },
    { label: "Certificados", value: m.operations.certificatesTotal, color: "bg-amber-500" },
  ] : [];

  // Company pie data
  const companyPieData = m?.users.companies.slice(0, 5).map((c) => ({ name: c.name, value: c.count })) || [];

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
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur-sm border",
                  healthScore >= 80 ? "bg-emerald-500/20 border-emerald-500/30" : healthScore >= 50 ? "bg-amber-500/20 border-amber-500/30" : "bg-red-500/20 border-red-500/30")}>
                  <Activity className={cn("h-5 w-5", healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400")} />
                </div>
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-tight">
                    Centro de Monitoramento
                  </h1>
                  <p className="text-xs text-white/60">Observabilidade & SLIs — Super Admin</p>
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
              <Button size="sm" variant={autoRefresh ? "default" : "outline"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn("h-8 text-xs", autoRefresh ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-white/20 text-white hover:bg-white/10")}>
                <Wifi className={cn("h-3 w-3 mr-1", autoRefresh && "animate-pulse")} />
                {autoRefresh ? "Live 30s" : "Manual"}
              </Button>
            </div>
          </div>

          {m && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="mt-5 flex items-center gap-3">
              <div className="flex-1">
                <Progress value={healthScore} className={cn("h-2.5 bg-white/10 [&>div]:transition-all [&>div]:duration-700", `[&>div]:${healthBg}`)} />
              </div>
              <Badge className={cn("text-xs font-bold", healthColor, "bg-transparent border border-current")}>
                {healthScore}% — {healthLabel}
              </Badge>
            </motion.div>
          )}
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

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="overview" className="text-xs gap-1.5"><Gauge className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="engagement" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" />Engajamento</TabsTrigger>
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

          {/* ═══════ OVERVIEW TAB ═══════ */}
          <TabsContent value="overview" className="space-y-6">
            {loading && !m ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : m && kpis && (
              <>
                {/* KPI Gauges */}
                <section>
                  <SectionTitle icon={Target} title="Indicadores-Chave (KPIs)" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiGauge icon={Percent} label="DAU/MAU Ratio" value={kpis.dauMauRatio} target={20} color="text-blue-500" />
                    <KpiGauge icon={CheckCircle2} label="Taxa de Conclusão" value={kpis.completionRate} target={40} color="text-emerald-500" />
                    <KpiGauge icon={Trophy} label="Aprovação Quiz" value={kpis.quizPassRate} target={70} color="text-amber-500" />
                    <KpiGauge icon={Eye} label="Retenção 7d" value={kpis.retentionRate7d} target={30} color="text-violet-500" />
                    <KpiGauge icon={CalendarDays} label="Retenção 30d" value={kpis.retentionRate30d} target={50} color="text-pink-500" />
                    <KpiGauge icon={TrendingUp} label="Crescimento semanal" value={kpis.growthRateWeek} suffix="%" color="text-cyan-500" />
                  </div>
                </section>

                {/* Users overview */}
                <section>
                  <SectionTitle icon={Users} title="Usuários" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Wifi} label="Online agora" value={m.users.onlineNow} color="text-emerald-500" />
                    <StatCard icon={Users} label="Ativos hoje (DAU)" value={m.users.activeToday} delta={m.users.newToday} deltaLabel="novos" color="text-blue-500" />
                    <StatCard icon={TrendingUp} label="Ativos 7d (WAU)" value={m.users.activeWeek} delta={m.users.newWeek} deltaLabel="novos" color="text-violet-500" />
                    <StatCard icon={Globe} label="Ativos 30d (MAU)" value={m.users.activeMonth} delta={m.users.newMonth} deltaLabel="novos" color="text-pink-500" />
                  </div>
                </section>

                {/* Streaks + Growth */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Activity by day chart */}
                  <section className="card-surface p-4">
                    <SectionTitle icon={BarChart3} title="Atividade por Dia (Semana)" />
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={m.activityByDay}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Bar dataKey="count" name="Aulas concluídas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Streak & Engagement stats */}
                  <section className="card-surface p-4">
                    <SectionTitle icon={Flame} title="Consistência (Streaks)" />
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-black text-foreground">{kpis.avgStreak}</p>
                        <p className="text-[10px] text-muted-foreground">Média de streak</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-amber-500">{kpis.maxStreak}</p>
                        <p className="text-[10px] text-muted-foreground">Maior streak</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-500">{kpis.activeStreaks}</p>
                        <p className="text-[10px] text-muted-foreground">Com streak ativo</p>
                      </div>
                    </div>

                    {/* Company distribution pie */}
                    {companyPieData.length > 0 && (
                      <>
                        <SectionTitle icon={PieChart} title="Top Empresas" />
                        <div className="h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <RPieChart>
                              <Pie data={companyPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                outerRadius={50} innerRadius={25} paddingAngle={2}>
                                {companyPieData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                              />
                            </RPieChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </section>
                </div>

                {/* Funnel */}
                <section>
                  <SectionTitle icon={TrendingDown} title="Funil de Conversão" />
                  <div className="card-surface p-4 space-y-3">
                    {funnelData.map((step) => (
                      <FunnelStep key={step.label} label={step.label} value={step.value}
                        total={funnelData[0].value} color={step.color} />
                    ))}
                  </div>
                </section>
              </>
            )}
          </TabsContent>

          {/* ═══════ ENGAGEMENT TAB ═══════ */}
          <TabsContent value="engagement" className="space-y-6">
            {m && (
              <>
                <section>
                  <SectionTitle icon={Zap} title="Métricas de Engajamento" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard icon={GraduationCap} label="Matrículas hoje" value={m.engagement.enrollmentsToday}
                      delta={m.engagement.enrollmentsWeek} deltaLabel="semana" color="text-blue-500" />
                    <StatCard icon={CheckCircle2} label="Aulas concluídas" value={m.engagement.lessonsCompletedToday}
                      delta={m.engagement.lessonsCompletedWeek} deltaLabel="semana" color="text-emerald-500" />
                    <StatCard icon={Trophy} label="Quizzes realizados" value={m.engagement.quizAttemptsToday}
                      delta={m.engagement.quizAttemptsWeek} deltaLabel="semana" color="text-amber-500" />
                    <StatCard icon={MessageSquare} label="Posts no fórum" value={m.engagement.forumPostsToday}
                      delta={m.engagement.forumPostsWeek} deltaLabel="semana" color="text-violet-500" />
                    <StatCard icon={Award} label="Badges ganhos" value={m.engagement.badgesEarnedToday}
                      delta={m.engagement.badgesEarnedWeek} deltaLabel="semana" color="text-pink-500" />
                  </div>
                </section>

                {/* Content stats */}
                <section>
                  <SectionTitle icon={Database} title="Conteúdo" />
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={BookOpen} label="Trilhas ativas" value={`${m.content.tracksActive}/${m.content.tracksTotal}`} color="text-primary" />
                    <StatCard icon={GraduationCap} label="Total de aulas" value={m.content.lessonsTotal} color="text-amber-500" />
                    <StatCard icon={ShieldCheck} label="Certificados" value={m.operations.certificatesTotal}
                      delta={m.operations.certificatesWeek} deltaLabel="semana" color="text-emerald-500" />
                  </div>
                </section>

                {/* Quiz performance */}
                <section>
                  <SectionTitle icon={Trophy} title="Performance em Quizzes" />
                  <div className="card-surface p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-black text-foreground">{m.engagement.quizAttemptsTotal}</p>
                        <p className="text-[10px] text-muted-foreground">Total de tentativas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-emerald-500">{m.engagement.quizPassedTotal}</p>
                        <p className="text-[10px] text-muted-foreground">Aprovações</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-amber-500">{m.kpis.quizPassRate}%</p>
                        <p className="text-[10px] text-muted-foreground">Taxa de aprovação</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-destructive">
                          {m.engagement.quizAttemptsTotal - m.engagement.quizPassedTotal}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Reprovações</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span>Aprovação</span><span className="ml-auto">{m.kpis.quizPassRate}%</span>
                      </div>
                      <Progress value={m.kpis.quizPassRate} className="h-2" />
                    </div>
                  </div>
                </section>

                {/* Gamification */}
                <section>
                  <SectionTitle icon={Coins} title="Gamificação" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard icon={Coins} label="Transações de moedas hoje" value={m.engagement.coinTransactionsToday} color="text-amber-500" />
                    <StatCard icon={Award} label="Badges hoje" value={m.engagement.badgesEarnedToday}
                      delta={m.engagement.badgesEarnedWeek} deltaLabel="semana" color="text-pink-500" />
                    <StatCard icon={Flame} label="Streaks ativos" value={m.kpis.activeStreaks} color="text-orange-500" />
                  </div>
                </section>
              </>
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

                {/* Company breakdown */}
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

                {/* Audit Logs */}
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
            {/* New alert rule form */}
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

            {/* Active rules */}
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

            {/* Alert history */}
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
