import { useState, useEffect } from "react";
import { BookOpen, GraduationCap, Users, ChevronRight, TrendingUp, Clock, AlertTriangle, Wifi, Building2, Circle, Shield, Activity, Award, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface OnlineUser {
  user_id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  last_active_at: string;
  avatar_url: string | null;
}

const ONLINE_THRESHOLD_MINUTES = 5;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const AdminDashboard = () => {
  const [stats, setStats] = useState({ tracks: 0, enrollments: 0, users: 0, activeEnrollments: 0, completedEnrollments: 0, certificates: 0 });
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [enrollmentsByDay, setEnrollmentsByDay] = useState<any[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(interval);
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

  const statCards = [
    { value: stats.tracks, label: "Trilhas ativas", icon: BookOpen, gradient: "from-primary to-accent" },
    { value: stats.enrollments, label: "Matrículas totais", sublabel: `${stats.activeEnrollments} ativas`, icon: GraduationCap, gradient: "from-primary to-accent" },
    { value: stats.users, label: "Usuários", icon: Users, gradient: "from-primary to-accent" },
    { value: stats.completedEnrollments, label: "Conclusões", sublabel: `${stats.certificates} certificados`, icon: TrendingUp, gradient: "from-primary to-accent" },
  ];

  const quickLinks = [
    { to: "/admin/trilhas-gestao", label: "Trilhas", icon: BookOpen },
    { to: "/admin/usuarios", label: "Usuários", icon: Users },
    { to: "/admin/matriculas", label: "Matrículas", icon: GraduationCap },
    { to: "/admin/relatorio-progresso", label: "Relatórios", icon: BarChart3 },
    { to: "/admin/gamificacao", label: "Gamificação", icon: Award },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative px-5 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <motion.div {...fadeUp}>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-primary-foreground/80" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
                  Painel Administrativo
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-primary-foreground">
                Visão Geral da Plataforma
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/75">
                {stats.users} usuários • {onlineUsers.length} online agora • {completionRate}% taxa de conclusão
              </p>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <Wifi className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{onlineUsers.length} online</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <Activity className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{completionRate}%</span>
              </div>
            </motion.div>
          </div>

          {/* Completion progress */}
          <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <Progress value={completionRate} className="h-2 bg-white/20 [&>div]:bg-white" />
            </div>
            <span className="text-xs font-bold text-primary-foreground tabular-nums">{completionRate}% conclusão</span>
          </motion.div>
        </div>
      </div>

      {/* Quick links */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all whitespace-nowrap"
          >
            <link.icon className="h-3.5 w-3.5" />
            {link.label}
          </Link>
        ))}
      </motion.div>

      {/* KPI Cards */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="card-surface-hover p-5 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-3xl font-bold text-foreground tabular-nums">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-primary">{stat.label}</p>
                {stat.sublabel && <p className="text-xs text-muted-foreground">{stat.sublabel}</p>}
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg shadow-primary/15`}>
                <stat.icon className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Online Users Panel */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="mt-6 card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Wifi className="h-5 w-5 text-green-500" />
              <Circle className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Usuários Online</h3>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
              {onlineUsers.length} online
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Atualiza a cada 30s</p>
        </div>

        {onlineUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum usuário online no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500 border-2 border-card rounded-full" />
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
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                      {getTimeSince(u.last_active_at)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div>
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
                          {users.length} {users.length === 1 ? "usuário" : "usuários"}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Alert: Inactive users */}
      {inactiveUsers > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="mt-6 card-surface border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
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

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="card-surface p-5">
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
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="card-surface p-5">
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
                    e.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                    e.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {e.status === "active" ? "Ativa" : e.status === "completed" ? "Concluída" : "Cancelada"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
