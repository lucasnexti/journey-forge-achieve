import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, GraduationCap, Users, TrendingUp, TrendingDown, Clock,
  AlertTriangle, Wifi, Building2, Circle, Shield, Activity, Award,
  BarChart3, Target, Trophy, ArrowRight, Zap, Globe, MessageSquare,
  Coins, Flame, Percent, CheckCircle2, Eye, CalendarDays, PieChart,
  Database, ShieldCheck, RefreshCw, Gauge, Bell, Gift,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
} from "recharts";
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
import {
  KpiGauge, StatCard, SectionTitle, FunnelStep, PIE_COLORS,
  type SystemMetrics,
} from "@/components/admin/MonitoringComponents";

/* ─── Types ─── */
interface OnlineUser {
  user_id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  last_active_at: string;
  avatar_url: string | null;
}

const ONLINE_THRESHOLD_MINUTES = 5;

/* ─── Quick-link card ─── */
const QuickLink = ({ icon: Icon, label, href, badge, color }: {
  icon: React.ElementType; label: string; href: string; badge?: number; color: string;
}) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className="card-surface-hover p-3.5 flex items-center gap-3 text-left group w-full"
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 h-5">{badge}</Badge>
      )}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

/* ─── Mini metric pill for hero ─── */
const HeroPill = ({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) => (
  <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-3 py-2">
    <Icon className="h-3.5 w-3.5 text-primary-foreground/80" />
    <div className="leading-none">
      <span className="text-sm font-bold text-primary-foreground tabular-nums">{value}</span>
      <span className="text-[10px] text-primary-foreground/60 ml-1.5 hidden sm:inline">{label}</span>
    </div>
  </div>
);

/* ─── MAIN COMPONENT ─── */
const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tracks: 0, enrollments: 0, users: 0, activeEnrollments: 0,
    completedEnrollments: 0, certificates: 0,
  });
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [enrollmentsByDay, setEnrollmentsByDay] = useState<any[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

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
    if (diff < 120) return "1 min";
    return `${Math.floor(diff / 60)} min`;
  };

  const empresaGroups = onlineUsers.reduce<Record<string, OnlineUser[]>>((acc, u) => {
    const key = u.empresa || "Sem empresa";
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  const completionRate = stats.enrollments > 0
    ? Math.round((stats.completedEnrollments / stats.enrollments) * 100) : 0;

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
      )) : 0;

  const healthColor = healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400";

  const funnelData = m ? [
    { label: "Cadastrados", value: m.users.total, color: "bg-blue-500" },
    { label: "Matriculados", value: m.engagement.enrollmentsTotal, color: "bg-violet-500" },
    { label: "Concluíram", value: m.engagement.enrollmentsCompleted, color: "bg-emerald-500" },
    { label: "Certificados", value: m.operations.certificatesTotal, color: "bg-amber-500" },
  ] : [];

  const companyPieData = m?.users.companies.slice(0, 5).map((c) => ({ name: c.name, value: c.count })) || [];

  // Pending operations count
  const pendingOps = m
    ? m.operations.trainingRequestsPending + m.operations.rewardRedemptionsPending
    : 0;

  return (
    <AdminLayout>
      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-white/8 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-extrabold text-primary-foreground leading-tight">
                {greeting()}{profileName ? `, ${profileName}` : ""}
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-primary-foreground/70">
                Painel administrativo · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1.5 flex-wrap"
            >
              <HeroPill icon={Users} value={stats.users} label="usuários" />
              <HeroPill icon={Wifi} value={onlineUsers.length} label="online" />
              <HeroPill icon={Activity} value={`${completionRate}%`} label="conclusão" />
              {m && (
                <div className={cn(
                  "flex items-center gap-2 rounded-xl backdrop-blur-md border px-3 py-2",
                  healthScore >= 80 ? "bg-emerald-500/20 border-emerald-400/30"
                    : healthScore >= 50 ? "bg-amber-500/20 border-amber-400/30"
                    : "bg-red-500/20 border-red-400/30"
                )}>
                  <Gauge className={cn("h-3.5 w-3.5", healthColor)} />
                  <span className="text-sm font-bold text-primary-foreground tabular-nums">{healthScore}%</span>
                  <span className="text-[10px] text-primary-foreground/60 hidden sm:inline">saúde</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Alerts strip */}
        {(inactiveUsers > 0 || pendingOps > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex flex-wrap gap-3">
            {inactiveUsers > 0 && (
              <Link to="/admin/notificacoes"
                className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm hover:bg-warning/10 transition-colors">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span className="text-foreground font-medium">{inactiveUsers} sem matrícula</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
            {m && m.operations.trainingRequestsPending > 0 && (
              <Link to="/admin/treinamentos"
                className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-sm hover:bg-blue-500/10 transition-colors">
                <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-foreground font-medium">{m.operations.trainingRequestsPending} treinamento(s) pendente(s)</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
            {m && m.operations.rewardRedemptionsPending > 0 && (
              <Link to="/admin/premios"
                className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-2.5 text-sm hover:bg-violet-500/10 transition-colors">
                <Gift className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-foreground font-medium">{m.operations.rewardRedemptionsPending} resgate(s) pendente(s)</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
          </motion.div>
        )}

        {/* ═══════ TABS ═══════ */}
        <Tabs defaultValue="geral" className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <TabsList className="bg-muted/50 h-9">
              <TabsTrigger value="geral" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Painel</TabsTrigger>
              <TabsTrigger value="overview" className="text-xs gap-1.5"><Gauge className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
              <TabsTrigger value="engagement" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" />Engajamento</TabsTrigger>
            </TabsList>
            {lastRefresh && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <Button size="sm" variant="ghost" onClick={fetchSystemMetrics} disabled={metricsLoading} className="h-7 w-7 p-0">
                  <RefreshCw className={cn("h-3 w-3", metricsLoading && "animate-spin")} />
                </Button>
              </div>
            )}
          </div>

          {/* ═══════ PAINEL TAB ═══════ */}
          <TabsContent value="geral" className="space-y-5 mt-0">
            {/* Stats row + Quick links — 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: KPI cards (2/3 width) */}
              <div className="lg:col-span-2 space-y-4">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Users, label: "Usuários", value: stats.users, color: "text-primary" },
                    { icon: GraduationCap, label: "Matrículas ativas", value: stats.activeEnrollments, color: "text-blue-500" },
                    { icon: CheckCircle2, label: "Concluídas", value: stats.completedEnrollments, color: "text-emerald-500" },
                    { icon: ShieldCheck, label: "Certificados", value: stats.certificates, color: "text-amber-500" },
                  ].map(({ icon: Icon, label, value, color }, i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card-surface p-4 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted", color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-xl sm:text-2xl font-black tabular-nums text-foreground">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Chart */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="card-surface p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Matrículas — últimos 7 dias</h3>
                    <Badge variant="secondary" className="text-[10px]">{stats.enrollments} total</Badge>
                  </div>
                  <div className="h-48 sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={enrollmentsByDay}>
                        <defs>
                          <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} width={28} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradientArea)" dot={{ fill: 'hsl(var(--primary))', r: 3.5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

              {/* Right: Quick links + Online (1/3 width) */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="space-y-4">
                {/* Quick links */}
                <div className="card-surface p-3 space-y-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                    Acesso rápido
                  </h4>
                  <QuickLink icon={Shield} label="Gerenciar Trilhas" href="/admin/trilhas-gestao" color="text-primary" />
                  <QuickLink icon={Users} label="Usuários" href="/admin/usuarios" color="text-blue-500" />
                  <QuickLink icon={Bell} label="Notificações" href="/admin/notificacoes"
                    badge={m?.operations.notificationsUnread} color="text-violet-500" />
                  <QuickLink icon={Trophy} label="Gamificação" href="/admin/gamificacao" color="text-amber-500" />
                  <QuickLink icon={Gift} label="Prêmios" href="/admin/premios"
                    badge={m?.operations.rewardRedemptionsPending} color="text-pink-500" />
                </div>

                {/* Online users compact */}
                <div className="card-surface p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Online agora
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">{onlineUsers.length}</Badge>
                  </div>

                  {onlineUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário online</p>
                  ) : (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-1">
                        {onlineUsers.slice(0, 8).map((u) => (
                          <div key={u.user_id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                  {u.nome?.slice(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-emerald-500 text-emerald-500 border-[1.5px] border-card rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{u.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.empresa || u.cargo || ""}</p>
                            </div>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                              {getTimeSince(u.last_active_at)}
                            </span>
                          </div>
                        ))}
                        {onlineUsers.length > 8 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            +{onlineUsers.length - 8} mais
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Companies breakdown mini */}
                  {Object.keys(empresaGroups).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                      {Object.entries(empresaGroups)
                        .sort((a, b) => b[1].length - a[1].length)
                        .slice(0, 4)
                        .map(([empresa, users]) => (
                          <div key={empresa} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate flex-1">{empresa}</span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-1.5">
                                {users.slice(0, 3).map((u) => (
                                  <Avatar key={u.user_id} className="h-5 w-5 border-[1.5px] border-card">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
                                      {u.nome?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                              <span className="text-muted-foreground tabular-nums">{users.length}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="card-surface p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Atividade Recente</h3>
                <Link to="/admin/matriculas" className="text-xs text-primary font-medium hover:underline">
                  Ver todas →
                </Link>
              </div>
              {recentEnrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma matrícula recente.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {recentEnrollments.map((e: any) => (
                    <div key={e.id} className="rounded-xl border border-border/50 p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-7 w-7 rounded-lg bg-gradient-nexti flex items-center justify-center shadow-sm">
                          <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          e.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : e.status === "completed"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {e.status === "active" ? "Ativa" : e.status === "completed" ? "Concluída" : "Cancelada"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{e.tracks?.title || "Trilha"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(e.enrolled_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Completion progress */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="card-surface p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">Taxa de Conclusão Geral</h3>
                <span className="text-lg font-black tabular-nums text-primary">{completionRate}%</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {stats.completedEnrollments} de {stats.enrollments} matrículas concluídas · {stats.tracks} trilhas ativas
              </p>
              <Progress value={completionRate} className="h-2.5" />
            </motion.div>
          </TabsContent>

          {/* ═══════ VISÃO GERAL TAB ═══════ */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {metricsLoading && !m ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : m && kpis && (
              <>
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

                <section>
                  <SectionTitle icon={Users} title="Usuários" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Wifi} label="Online agora" value={m.users.onlineNow} color="text-emerald-500" />
                    <StatCard icon={Users} label="Ativos hoje (DAU)" value={m.users.activeToday} delta={m.users.newToday} deltaLabel="novos" color="text-blue-500" />
                    <StatCard icon={TrendingUp} label="Ativos 7d (WAU)" value={m.users.activeWeek} delta={m.users.newWeek} deltaLabel="novos" color="text-violet-500" />
                    <StatCard icon={Globe} label="Ativos 30d (MAU)" value={m.users.activeMonth} delta={m.users.newMonth} deltaLabel="novos" color="text-pink-500" />
                  </div>
                </section>

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
                        <p className="text-[10px] text-muted-foreground">Média</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-amber-500">{kpis.maxStreak}</p>
                        <p className="text-[10px] text-muted-foreground">Maior</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-500">{kpis.activeStreaks}</p>
                        <p className="text-[10px] text-muted-foreground">Ativos</p>
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
          <TabsContent value="engagement" className="space-y-6 mt-0">
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
