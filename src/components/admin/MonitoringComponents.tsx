import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/* ─── Types ─── */
export interface SystemMetrics {
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

/* ─── KpiGauge ─── */
export const KpiGauge = ({ value, label, target, suffix = "%", icon: Icon, color = "text-primary" }: {
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

/* ─── StatCard ─── */
export const StatCard = ({
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

/* ─── SectionTitle ─── */
export const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</h2>
  </div>
);

/* ─── FunnelStep ─── */
export const FunnelStep = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
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

export const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
