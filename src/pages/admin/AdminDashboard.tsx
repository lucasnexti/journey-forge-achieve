import { useState, useEffect, useCallback } from "react";
import { BookOpen, GraduationCap, Users, ChevronRight, TrendingUp, TrendingDown, Clock, AlertTriangle, Wifi, Building2, Circle, Shield, Activity, Award, BarChart3, Play, Target, Trophy, ArrowRight, Search, Sparkles, Zap, Globe, MessageSquare, Coins, Flame, Percent, CheckCircle2, Eye, CalendarDays, PieChart, Database, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RPieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RefreshCw, Gauge } from "lucide-react";
import { KpiGauge, StatCard, SectionTitle, FunnelStep, PIE_COLORS, type SystemMetrics } from "@/components/admin/MonitoringComponents";

interface OnlineUser {
  user_id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  last_active_at: string;
  avatar_url: string | null;
}

const ONLINE_THRESHOLD_MINUTES = 5;

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ tracks: 0, enrollments: 0, users: 0, activeEnrollments: 0, completedEnrollments: 0, certificates: 0 });
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [enrollmentsByDay, setEnrollmentsByDay] = useState<any[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

  // System metrics state (for overview & engagement tabs)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchOnlineUsers();
    fetchSystemMetrics();
    const interval = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchSystemMetrics, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfileName(data.nome || "");
    });
  }, [user]);

  const fetchSystemMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const { data, error } = await supabase.functions.invoke("system-metrics");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMetrics(data as SystemMetrics);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.error("Erro ao carregar métricas:", e.message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const fetchOnlineUsers = async () => {
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, empresa, cargo, last_active_at, avatar_url")
      .gte("last_active_at", threshold)
      .order("last_active_at", { ascending: false });
    setOnlineUsers((data as OnlineUser[]) || []);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const [tracksRes, profilesRes, enrollmentsRes, certsRes] = await Promise.all([
      supabase.from("tracks").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("profiles").select("id, created_at, is_active", { count: "exact" }),
      supabase.from("enrollments").select("id, status, enrolled_at, track_id, tracks(title)"),
      supabase.from("certificates").select("id", { count: "exact", head: true }),
    ]);

    const enrollments = (enrollmentsRes.data || []) as any[];
    const profiles = (profilesRes.data || []) as any[];
    const active = enrollments.filter(e => e.status === "active").length;
    const completed = enrollments.filter(e => e.status === "completed").length;

    const enrolledUserIds = new Set(enrollments.map(e => e.user_id));
    const inactive = profiles.filter(p => !enrolledUserIds.has(p.id)).length;
    setInactiveUsers(inactive);

    setStats({
      tracks: tracksRes.count || 0,
      enrollments: enrollments.length,
      users: profilesRes.count || 0,
      activeEnrollments: active,
      completedEnrollments: completed,
      certificates: certsRes.count || 0,
    });

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const byDay = last7.map(date => {
      const dayStr = date.toISOString().split('T')[0];
      const count = enrollments.filter(e => e.enrolled_at?.startsWith(dayStr)).length;
      return { day: days[date.getDay()], value: count };
    });
    setEnrollmentsByDay(byDay);

    const recent = enrollments
      .sort((a: any, b: any) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime())
      .slice(0, 5);
    setRecentEnrollments(recent);
    setLoading(false);
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 120) return "1 min atrás";
    return `${Math.floor(diff / 60)} min atrás`;
  };

  const empresaGroups = onlineUsers.reduce<Record<string, OnlineUser[]>>((acc, u) => {
    const key = u.empresa || "Sem empresa";
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  const completionRate = stats.enrollments > 0
    ? Math.round((stats.completedEnrollments / stats.enrollments) * 100)
    : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const m = metrics;
  const kpis = m?.kpis;

  const healthScore = m && kpis
    ? Math.min(100, Math.round(
        (m.users.onlineNow > 0 ? 20 : 0) +
        (kpis.retentionRate7d >= 30 ? 20 : kpis.retentionRate7d >= 15 ? 10 : 0) +
        (kpis.completionRate >= 20 ? 20 : kpis.completionRate >= 10 ? 10 : 0) +
        (m.operations.trainingRequestsPending < 10 ? 20 : m.operations.trainingRequestsPending < 20 ? 10 : 0) +
        (kpis.dauMauRatio >= 10 ? 20 : kpis.dauMauRatio >= 5 ? 10 : 0)
      ))
    : 0;

  const funnelData = m ? [
    { label: "Cadastrados", value: m.users.total, color: "bg-blue-500" },
    { label: "Matriculados", value: m.engagement.enrollmentsTotal, color: "bg-violet-500" },
    { label: "Concluíram", value: m.engagement.enrollmentsCompleted, color: "bg-emerald-500" },
    { label: "Certificados", value: m.operations.certificatesTotal, color: "bg-amber-500" },
  ] : [];

  const companyPieData = m?.users.companies.slice(0, 5).map((c) => ({ name: c.name, value: c.count })) || [];

  return (
    <AdminLayout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary-foreground">
                {greeting()}{profileName ? `, ${profileName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {stats.users} usuários • {onlineUsers.length} online agora • {completionRate}% taxa de conclusão
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <Wifi className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{onlineUsers.length}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <Activity className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{completionRate}%</span>
              </div>
              {m && (
                <div className={cn("flex items-center gap-2 rounded-xl backdrop-blur-md border px-4 py-2.5",
                  healthScore >= 80 ? "bg-emerald-500/20 border-emerald-400/30" : healthScore >= 50 ? "bg-amber-500/20 border-amber-400/30" : "bg-red-500/20 border-red-400/30")}>
                  <Gauge className="h-4 w-4 text-primary-foreground" />
                  <span className="text-sm font-bold text-primary-foreground tabular-nums">{healthScore}%</span>
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-5 flex items-center gap-3"
          >
            <div className="flex-1">
              <Progress value={completionRate} className="h-2 bg-white/20 [&>div]:bg-white" />
            </div>
            <span className="text-sm font-bold text-primary-foreground tabular-nums">{completionRate}%</span>
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Quick action card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <button
            onClick={() => navigate("/admin/trilhas-gestao")}
            className="w-full card-surface-hover flex items-center gap-4 p-4 sm:p-5 text-left group"
          >
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-nexti shadow-lg shadow-primary/20">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-0.5">
                Gerenciar Plataforma
              </p>
              <p className="font-display text-sm sm:text-base font-semibold text-foreground truncate">
                {stats.tracks} trilhas ativas • {stats.activeEnrollments} matrículas em andamento
              </p>
              <p className="text-xs text-muted-foreground truncate">Gerencie trilhas, usuários e conteúdos</p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Quick stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            { icon: Target, label: "Progresso", value: `${completionRate}%`, color: "text-primary" },
            { icon: BookOpen, label: "Concluídas", value: `${stats.completedEnrollments}/${stats.enrollments}`, color: "text-emerald-500" },
            { icon: Clock, label: "Certificados", value: `${stats.certificates}`, color: "text-muted-foreground" },
            { icon: Trophy, label: "Usuários", value: `${stats.users}`, color: "text-amber-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card-surface p-3 sm:p-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold tabular-nums text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Inactive users alert */}
        {inactiveUsers > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 card-surface border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{inactiveUsers} usuário(s) sem matrícula</p>
              <p className="text-xs text-muted-foreground">Considere enviar notificações ou matriculá-los em trilhas.</p>
            </div>
            <Link to="/admin/notificacoes" className="text-xs font-semibold text-primary hover:underline shrink-0">
              Enviar notificação →
            </Link>
          </motion.div>
        )}

        {/* ═══════ TABS: Geral | Visão Geral | Engajamento ═══════ */}
        <Tabs defaultValue="geral" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50 h-9">
              <TabsTrigger value="geral" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Painel</TabsTrigger>
              <TabsTrigger value="overview" className="text-xs gap-1.5"><Gauge className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
              <TabsTrigger value="engagement" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" />Engajamento</TabsTrigger>
            </TabsList>
            {lastRefresh && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {lastRefresh.toLocaleTimeString("pt-BR")}
                </span>
                <Button size="sm" variant="ghost" onClick={fetchSystemMetrics} disabled={metricsLoading} className="h-7 w-7 p-0">
                  <RefreshCw className={cn("h-3 w-3", metricsLoading && "animate-spin")} />
                </Button>
              </div>
            )}
          </div>

          {/* ═══════ PAINEL TAB (original dashboard content) ═══════ */}
          <TabsContent value="geral" className="space-y-6">
            {/* Online Users */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Wifi className="h-3 w-3 text-emerald-500" />
                </div>
                <h2 className="font-display text-base font-bold text-foreground">Usuários Online</h2>
                <Badge variant="secondary" className="text-[10px]">{onlineUsers.length}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">Atualiza a cada 30s</span>
              </div>

              {onlineUsers.length === 0 ? (
                <div className="card-surface text-center py-8">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário online no momento</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card-surface p-4">
                    <ScrollArea className="max-h-72">
                      <div className="space-y-2">
                        {onlineUsers.map((u) => (
                          <div key={u.user_id} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="relative">
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {u.nome?.slice(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-emerald-500 text-emerald-500 border-2 border-card rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{u.nome}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {u.empresa && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {u.empresa}
                                  </span>
                                )}
                                {u.cargo && <span>• {u.cargo}</span>}
                              </div>
                            </div>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                              {getTimeSince(u.last_active_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="card-surface p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Por Empresa</h4>
                    <div className="space-y-2">
                      {Object.entries(empresaGroups)
                        .sort((a, b) => b[1].length - a[1].length)
                        .map(([empresa, users]) => (
                          <div key={empresa} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium text-foreground">{empresa}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {users.slice(0, 4).map((u) => (
                                  <Avatar key={u.user_id} className="h-6 w-6 border-2 border-card">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                      {u.nome?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {users.length > 4 && (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border-2 border-card text-[10px] font-bold text-muted-foreground">
                                    +{users.length - 4}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {users.length}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Charts */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-3 w-3 text-primary" />
                </div>
                <h2 className="font-display text-base font-bold text-foreground">Análises</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card-surface p-5">
                  <h3 className="text-sm font-semibold text-foreground">Matrículas nos últimos 7 dias</h3>
                  <div className="mt-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={enrollmentsByDay}>
                        <defs>
                          <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradientArea)" dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card-surface p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Atividade Recente</h3>
                  {recentEnrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma matrícula recente.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentEnrollments.map((e: any) => (
                        <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
                            <GraduationCap className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{e.tracks?.title || "Trilha"}</p>
                            <p className="text-xs text-muted-foreground">
                              <Clock className="inline h-3 w-3 mr-1" />
                              {new Date(e.enrolled_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            e.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                            e.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                          }`}>
                            {e.status === "active" ? "Ativa" : e.status === "completed" ? "Concluída" : "Cancelada"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </TabsContent>

          {/* ═══════ VISÃO GERAL TAB ═══════ */}
          <TabsContent value="overview" className="space-y-6">
            {metricsLoading && !m ? (
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

                {/* Activity + Streaks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="card-surface p-4">
                    <SectionTitle icon={BarChart3} title="Atividade por Dia (Semana)" />
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={m.activityByDay}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                          <Bar dataKey="count" name="Aulas concluídas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

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
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
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

          {/* ═══════ ENGAJAMENTO TAB ═══════ */}
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

                <section>
                  <SectionTitle icon={Database} title="Conteúdo" />
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={BookOpen} label="Trilhas ativas" value={`${m.content.tracksActive}/${m.content.tracksTotal}`} color="text-primary" />
                    <StatCard icon={GraduationCap} label="Total de aulas" value={m.content.lessonsTotal} color="text-amber-500" />
                    <StatCard icon={ShieldCheck} label="Certificados" value={m.operations.certificatesTotal}
                      delta={m.operations.certificatesWeek} deltaLabel="semana" color="text-emerald-500" />
                  </div>
                </section>

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
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
