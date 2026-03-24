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
  TrendingUp, BarChart3, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SystemMetrics {
  timestamp: string;
  users: {
    total: number;
    onlineNow: number;
    activeToday: number;
    activeWeek: number;
    companies: { name: string; count: number }[];
  };
  content: {
    tracksTotal: number;
    tracksActive: number;
    lessonsTotal: number;
  };
  engagement: {
    enrollmentsTotal: number;
    enrollmentsToday: number;
    lessonsCompletedToday: number;
    lessonsCompletedWeek: number;
    quizAttemptsToday: number;
    quizAttemptsWeek: number;
    forumPostsToday: number;
    coinTransactionsToday: number;
    badgesEarnedToday: number;
  };
  operations: {
    certificatesTotal: number;
    certificatesToday: number;
    trainingRequestsPending: number;
    trainingRequestsTotal: number;
    rewardRedemptionsPending: number;
    notificationsUnread: number;
  };
  recentAuditLogs: { id: string; action: string; entity_type: string; created_at: string }[];
}

const MetricCard = ({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
  pulse = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  pulse?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="card-surface p-4 flex items-center gap-3"
  >
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted", color)}>
      <Icon className={cn("h-5 w-5", pulse && "animate-pulse")} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xl font-extrabold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

const AdminMonitoramento = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superLoading } = useIsSuperAdmin();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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

  useEffect(() => {
    if (isSuperAdmin) fetchMetrics();
  }, [isSuperAdmin, fetchMetrics]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh || !isSuperAdmin) return;
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, isSuperAdmin, fetchMetrics]);

  if (authLoading || superLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const m = metrics;
  const healthScore = m
    ? Math.min(100, Math.round(
        (m.users.onlineNow > 0 ? 25 : 0) +
        (m.engagement.lessonsCompletedToday > 0 ? 25 : 10) +
        (m.operations.trainingRequestsPending < 10 ? 25 : 10) +
        (m.operations.rewardRedemptionsPending < 5 ? 25 : 10)
      ))
    : 0;

  const healthColor = healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-destructive";
  const healthLabel = healthScore >= 80 ? "Saudável" : healthScore >= 50 ? "Atenção" : "Crítico";

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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-tight">
                    Monitoramento do Sistema
                  </h1>
                  <p className="text-xs text-white/60">
                    Painel exclusivo — Super Administrador
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-[10px] text-white/40">
                  Atualizado: {lastRefresh.toLocaleTimeString("pt-BR")}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={fetchMetrics}
                disabled={loading}
                className="border-white/20 text-white hover:bg-white/10 h-8 text-xs"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
                Atualizar
              </Button>
              <Button
                size="sm"
                variant={autoRefresh ? "default" : "outline"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "h-8 text-xs",
                  autoRefresh
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-white/20 text-white hover:bg-white/10"
                )}
              >
                <Wifi className={cn("h-3 w-3 mr-1", autoRefresh && "animate-pulse")} />
                {autoRefresh ? "Auto 30s" : "Manual"}
              </Button>
            </div>
          </div>

          {/* Health bar */}
          {m && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 flex items-center gap-3"
            >
              <div className="flex-1">
                <Progress value={healthScore} className="h-2 bg-white/10 [&>div]:bg-emerald-500" />
              </div>
              <Badge className={cn("text-xs", healthColor, "bg-transparent border border-current")}>
                {healthScore}% — {healthLabel}
              </Badge>
            </motion.div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="card-surface border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && !m && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {m && (
          <>
            {/* ── USERS ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Usuários</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon={Wifi} label="Online agora" value={m.users.onlineNow} color="text-emerald-500" pulse sub="Últimos 5 min" />
                <MetricCard icon={Users} label="Ativos hoje" value={m.users.activeToday} color="text-blue-500" sub="Últimas 24h" />
                <MetricCard icon={TrendingUp} label="Ativos na semana" value={m.users.activeWeek} color="text-violet-500" sub="Últimos 7 dias" />
                <MetricCard icon={Globe} label="Total cadastrados" value={m.users.total} color="text-muted-foreground" />
              </div>

              {/* Companies breakdown */}
              {m.users.companies.length > 0 && (
                <div className="mt-3 card-surface p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Distribuição por Empresa</p>
                  <div className="space-y-2">
                    {m.users.companies.slice(0, 10).map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground min-w-[120px] truncate">{c.name}</span>
                        <div className="flex-1">
                          <Progress
                            value={Math.round((c.count / m.users.total) * 100)}
                            className="h-1.5"
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── CONTENT ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Conteúdo</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={BookOpen} label="Trilhas ativas" value={`${m.content.tracksActive}/${m.content.tracksTotal}`} color="text-primary" />
                <MetricCard icon={GraduationCap} label="Total de aulas" value={m.content.lessonsTotal} color="text-amber-500" />
                <MetricCard icon={ShieldCheck} label="Certificados emitidos" value={m.operations.certificatesTotal} sub={`+${m.operations.certificatesToday} hoje`} color="text-emerald-500" />
              </div>
            </section>

            {/* ── ENGAGEMENT ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Engajamento (Hoje / Semana)</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard icon={GraduationCap} label="Matrículas" value={m.engagement.enrollmentsToday} sub={`Total: ${m.engagement.enrollmentsTotal}`} color="text-blue-500" />
                <MetricCard icon={CheckCircle2} label="Aulas concluídas" value={m.engagement.lessonsCompletedToday} sub={`Semana: ${m.engagement.lessonsCompletedWeek}`} color="text-emerald-500" />
                <MetricCard icon={Trophy} label="Quizzes feitos" value={m.engagement.quizAttemptsToday} sub={`Semana: ${m.engagement.quizAttemptsWeek}`} color="text-amber-500" />
                <MetricCard icon={MessageSquare} label="Posts no fórum" value={m.engagement.forumPostsToday} color="text-violet-500" />
                <MetricCard icon={Award} label="Badges ganhos" value={m.engagement.badgesEarnedToday} color="text-pink-500" />
              </div>
            </section>

            {/* ── OPERATIONS ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Operações Pendentes</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  icon={Clock}
                  label="Treinamentos pendentes"
                  value={m.operations.trainingRequestsPending}
                  sub={`Total: ${m.operations.trainingRequestsTotal}`}
                  color={m.operations.trainingRequestsPending > 5 ? "text-amber-500" : "text-emerald-500"}
                />
                <MetricCard
                  icon={Gift}
                  label="Resgates pendentes"
                  value={m.operations.rewardRedemptionsPending}
                  color={m.operations.rewardRedemptionsPending > 3 ? "text-amber-500" : "text-emerald-500"}
                />
                <MetricCard icon={Bell} label="Notificações não lidas" value={m.operations.notificationsUnread} color="text-blue-500" />
                <MetricCard icon={Coins} label="Transações de moedas hoje" value={m.engagement.coinTransactionsToday} color="text-amber-500" />
              </div>
            </section>

            {/* ── AUDIT LOGS ── */}
            {m.recentAuditLogs.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Últimos Logs de Auditoria</h2>
                </div>
                <div className="card-surface overflow-hidden">
                  <div className="divide-y divide-border">
                    {m.recentAuditLogs.map((log) => (
                      <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {log.entity_type}
                        </Badge>
                        <span className="text-foreground font-medium truncate flex-1">{log.action}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {new Date(log.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMonitoramento;
