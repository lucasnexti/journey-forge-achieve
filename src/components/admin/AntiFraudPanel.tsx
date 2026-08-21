import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, RefreshCw, TrendingUp, Coins, UserX, Gauge, ClipboardList, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface FraudReport {
  since: string;
  totals: { earned: number; spent: number; transactions: number; manual_adjustments: number };
  unverified: { id: string; nome: string | null; amount: number; reason: string; reference_type: string; reference_id: string | null; created_at: string }[];
  negative_balances: { user_id: string; nome: string | null; balance: number }[];
  velocity_spikes: { user_id: string; nome: string | null; hour: string; events: number; coins: number }[];
  top_earners: { user_id: string; nome: string | null; empresa: string | null; coins: number; events: number }[];
  manual_log: { id: string; nome: string | null; amount: number; reason: string; created_at: string }[];
  badges_without_evidence: { id: string; nome: string | null; badge: string; criteria_type: string; earned_at: string }[];
}

const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const Stat = ({ icon: Icon, label, value, tone = "text-primary" }: { icon: React.ElementType; label: string; value: string | number; tone?: string }) => (
  <div className="card-surface p-4 flex items-center gap-3">
    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-muted", tone)}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-extrabold tabular-nums text-foreground">{value}</p>
    </div>
  </div>
);

const Block = ({ icon: Icon, title, count, empty, children }: { icon: React.ElementType; title: string; count: number; empty: string; children: React.ReactNode }) => (
  <div className="card-surface p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <span className={cn("ml-auto text-xs font-bold tabular-nums rounded-full px-2 py-0.5",
        count > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>{count}</span>
    </div>
    {count === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p> : <div className="space-y-1.5 max-h-72 overflow-auto pr-1">{children}</div>}
  </div>
);

const Row = ({ title, subtitle, value, tone }: { title: string; subtitle: string; value: string; tone?: string }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-medium text-foreground">{title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
    <span className={cn("text-xs font-bold tabular-nums shrink-0", tone ?? "text-foreground")}>{value}</span>
  </div>
);

export default function AntiFraudPanel() {
  const [report, setReport] = useState<FraudReport | null>(null);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const load = async (d = days) => {
    setLoading(true);
    const { data } = await supabase.rpc("gamification_fraud_report", { _days: Number(d) });
    setReport((data ?? null) as unknown as FraudReport | null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const alerts = report
    ? report.unverified.length + report.negative_balances.length + report.velocity_spikes.length + report.badges_without_evidence.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn("h-4 w-4", alerts > 0 ? "text-destructive" : "text-success")} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Auditoria Anti-Fraude</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={days} onValueChange={(v) => { setDays(v); load(v); }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="365">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="gap-1">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </div>

      {loading && !report ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">Analisando transações...</div>
      ) : !report ? (
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">Sem dados disponíveis.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Coins} label="Moedas ganhas" value={report.totals.earned} tone="text-warning" />
            <Stat icon={TrendingUp} label="Moedas gastas" value={report.totals.spent} />
            <Stat icon={ClipboardList} label="Transações" value={report.totals.transactions} />
            <Stat icon={ShieldAlert} label="Alertas abertos" value={alerts} tone={alerts > 0 ? "text-destructive" : "text-success"} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Block icon={ShieldAlert} title="Ganhos sem comprovação" count={report.unverified.length}
              empty="Todos os ganhos possuem evidência no banco.">
              {report.unverified.map((t) => (
                <Row key={t.id} title={t.nome ?? "Usuário"} subtitle={`${t.reason} · ${t.reference_type} · ${fmtDate(t.created_at)}`}
                  value={`+${t.amount}`} tone="text-destructive" />
              ))}
            </Block>

            <Block icon={Gauge} title="Picos de velocidade" count={report.velocity_spikes.length}
              empty="Nenhum acúmulo anormal por hora.">
              {report.velocity_spikes.map((v, i) => (
                <Row key={i} title={v.nome ?? "Usuário"} subtitle={`${v.events} eventos · ${fmtDate(v.hour)}`}
                  value={`+${v.coins}`} tone="text-warning" />
              ))}
            </Block>

            <Block icon={Award} title="Badges sem evidência" count={report.badges_without_evidence.length}
              empty="Todas as conquistas atendem aos critérios.">
              {report.badges_without_evidence.map((b) => (
                <Row key={b.id} title={b.nome ?? "Usuário"} subtitle={`${b.badge} · ${b.criteria_type}`} value={fmtDate(b.earned_at)} tone="text-destructive" />
              ))}
            </Block>

            <Block icon={UserX} title="Saldos negativos" count={report.negative_balances.length}
              empty="Nenhum saldo inconsistente.">
              {report.negative_balances.map((b) => (
                <Row key={b.user_id} title={b.nome ?? "Usuário"} subtitle="Saldo abaixo de zero" value={String(b.balance)} tone="text-destructive" />
              ))}
            </Block>

            <Block icon={ClipboardList} title={`Ajustes manuais (${report.totals.manual_adjustments})`} count={report.manual_log.length}
              empty="Nenhum ajuste manual no período.">
              {report.manual_log.map((m) => (
                <Row key={m.id} title={m.nome ?? "Usuário"} subtitle={`${m.reason} · ${fmtDate(m.created_at)}`}
                  value={`${m.amount > 0 ? "+" : ""}${m.amount}`} tone={m.amount > 0 ? "text-warning" : "text-muted-foreground"} />
              ))}
            </Block>

            <Block icon={TrendingUp} title="Maiores ganhadores" count={report.top_earners.length}
              empty="Sem ganhos no período.">
              {report.top_earners.map((u) => (
                <Row key={u.user_id} title={u.nome ?? "Usuário"} subtitle={`${u.empresa ?? "—"} · ${u.events} eventos`} value={`+${u.coins}`} />
              ))}
            </Block>
          </div>
        </>
      )}
    </div>
  );
}
