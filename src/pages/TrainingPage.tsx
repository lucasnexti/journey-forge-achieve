import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import {
  GraduationCap, Clock, Users, CalendarDays, Send, CheckCircle2, Loader2,
  XCircle, AlertCircle, Monitor, MapPin, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  duration_hours: number;
  cost_per_hour: number;
  cost_per_hour_remote: number;
  category: string | null;
  is_active: boolean;
}

interface TrainingRequest {
  id: string;
  module_id: string;
  preferred_date: string | null;
  participants: number;
  notes: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  modality: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: "Pendente", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
};

// Discount tiers based on total contracted hours
const discountTiers = [
  { minHours: 2, discount: 0.10, label: "10% off" },
  { minHours: 3, discount: 0.15, label: "15% off" },
  { minHours: 5, discount: 0.20, label: "20% off" },
  { minHours: 8, discount: 0.25, label: "25% off" },
];

function getDiscountForHours(totalHours: number): number {
  let discount = 0;
  for (const tier of discountTiers) {
    if (totalHours >= tier.minHours) discount = tier.discount;
  }
  return discount;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TrainingPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"modules" | "requests">("modules");

  // Selection state: which modules are "contracted"
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Per-module custom discount override (optional)
  const [customDiscount, setCustomDiscount] = useState<Record<string, string>>({});
  // Per-module bonus days
  const [bonusDays, setBonusDays] = useState<Record<string, string>>({});

  // Modality for the whole package
  const [modality, setModality] = useState<"presencial" | "remoto">("presencial");

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [participants, setParticipants] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: modData }, { data: reqData }] = await Promise.all([
        supabase.from("training_modules").select("*").eq("is_active", true).order("order_index"),
        supabase.from("training_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setModules((modData as TrainingModule[]) || []);
      setRequests((reqData as TrainingRequest[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const selectedModules = useMemo(
    () => modules.filter((m) => selected[m.id]),
    [modules, selected]
  );

  const totalHours = useMemo(
    () => selectedModules.reduce((sum, m) => sum + m.duration_hours, 0),
    [selectedModules]
  );

  const autoDiscount = getDiscountForHours(totalHours);

  const getOriginalPrice = (mod: TrainingModule) =>
    modality === "remoto" ? Number(mod.cost_per_hour_remote) : Number(mod.cost_per_hour);

  const getModuleDiscount = (mod: TrainingModule) => {
    const custom = customDiscount[mod.id];
    if (custom !== undefined && custom !== "") {
      return parseFloat(custom) / 100;
    }
    return autoDiscount;
  };

  const getUnitPrice = (mod: TrainingModule) => {
    const original = getOriginalPrice(mod);
    const disc = getModuleDiscount(mod);
    return original * (1 - disc);
  };

  const getModuleTotal = (mod: TrainingModule) => {
    return getUnitPrice(mod) * mod.duration_hours;
  };

  const grandTotalOriginal = selectedModules.reduce(
    (sum, m) => sum + getOriginalPrice(m) * m.duration_hours,
    0
  );
  const grandTotalFinal = selectedModules.reduce(
    (sum, m) => sum + getModuleTotal(m),
    0
  );
  const grandTotalUnitAvg = selectedModules.length > 0
    ? selectedModules.reduce((sum, m) => sum + getUnitPrice(m), 0) / selectedModules.length
    : 0;

  const handleToggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    if (!user || selectedModules.length === 0) return;
    setSubmitting(true);

    const inserts = selectedModules.map((mod) => ({
      user_id: user.id,
      module_id: mod.id,
      preferred_date: preferredDate || null,
      participants,
      notes: notes.trim() || null,
      modality,
    }));

    const { error } = await supabase.from("training_requests").insert(inserts);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
    } else {
      toast.success(`${selectedModules.length} módulo(s) solicitado(s) com sucesso!`);
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles) {
        const notifications = adminRoles.map((r: any) => ({
          user_id: r.user_id,
          title: "Nova solicitação de treinamento",
          message: `${user.email} solicitou ${selectedModules.length} módulo(s) — ${modality}, ${participants} participantes, total ${fmt(grandTotalFinal)}`,
          type: "training",
        }));
        await supabase.from("notifications").insert(notifications);
      }
      const { data: reqData } = await supabase
        .from("training_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRequests((reqData as TrainingRequest[]) || []);
      setSelected({});
      setCustomDiscount({});
      setBonusDays({});
      setShowRequestForm(false);
      setPreferredDate("");
      setParticipants(1);
      setNotes("");
      setTab("requests");
    }
    setSubmitting(false);
  };

  const categories = [...new Set(modules.map((m) => m.category).filter(Boolean))] as string[];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-primary-foreground leading-tight">
                  Pacote de Treinamentos
                </h1>
                <p className="text-xs sm:text-sm text-primary-foreground/70">
                  Selecione os módulos e monte seu pacote com desconto progressivo
                </p>
              </div>
            </div>
          </motion.div>

          {/* Tab switcher */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-5 inline-flex rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10"
          >
            {[
              { key: "modules" as const, label: "Montar Pacote" },
              { key: "requests" as const, label: "Minhas Solicitações" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setShowRequestForm(false); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  tab === key
                    ? "bg-white text-primary shadow-sm"
                    : "text-primary-foreground/70 hover:text-primary-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {tab === "modules" && !showRequestForm && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Modality selector */}
            <div className="flex items-center gap-4 mb-6">
              <Label className="text-sm font-semibold text-foreground">Modalidade:</Label>
              <div className="inline-flex rounded-lg border border-border bg-card p-1 gap-1">
                {([
                  { key: "presencial" as const, label: "Presencial", icon: MapPin },
                  { key: "remoto" as const, label: "Remoto", icon: Monitor },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setModality(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      modality === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {totalHours > 0 && (
                <Badge variant="outline" className="ml-auto text-xs gap-1">
                  <Package className="h-3 w-3" />
                  {totalHours}h selecionada{totalHours > 1 ? "s" : ""} — desconto {(autoDiscount * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            {/* Discount tiers info */}
            <div className="flex flex-wrap gap-2 mb-5">
              {discountTiers.map((tier) => (
                <div
                  key={tier.minHours}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    totalHours >= tier.minHours
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/50 text-muted-foreground border-border/50"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {tier.minHours}h+ → {tier.label}
                </div>
              ))}
            </div>

            {/* Module Table */}
            {categories.map((cat, ci) => {
              const catModules = modules.filter((m) => m.category === cat);
              if (catModules.length === 0) return null;
              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      {cat}
                    </h2>
                  </div>

                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold text-muted-foreground w-[40%]">Módulo</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[100px]">Contratado?</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[90px]">Original</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[90px]">Desconto %</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[90px]">Bonif. (dias)</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[90px]">Unitário</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[110px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catModules.map((mod) => {
                          const isOn = !!selected[mod.id];
                          const origPrice = getOriginalPrice(mod);
                          const disc = getModuleDiscount(mod);
                          const unitPrice = getUnitPrice(mod);
                          const total = getModuleTotal(mod);

                          return (
                            <TableRow
                              key={mod.id}
                              className={cn(
                                "transition-colors",
                                isOn && "bg-primary/[0.03]"
                              )}
                            >
                              <TableCell className="py-3">
                                <div>
                                  <p className={cn(
                                    "text-sm font-semibold leading-snug",
                                    isOn ? "text-foreground" : "text-muted-foreground"
                                  )}>
                                    {mod.title}
                                  </p>
                                  {mod.description && (
                                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                                      {mod.description}
                                    </p>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/50 mt-0.5 inline-block">
                                    {mod.duration_hours}h de duração
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={isOn}
                                  onCheckedChange={() => handleToggle(mod.id)}
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                {fmt(origPrice)}
                              </TableCell>
                              <TableCell className="text-center">
                                {isOn ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={50}
                                    className="h-8 w-16 mx-auto text-center text-xs tabular-nums"
                                    value={customDiscount[mod.id] ?? (autoDiscount * 100).toFixed(0)}
                                    onChange={(e) =>
                                      setCustomDiscount((prev) => ({
                                        ...prev,
                                        [mod.id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {isOn ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={365}
                                    className="h-8 w-16 mx-auto text-center text-xs tabular-nums"
                                    value={bonusDays[mod.id] ?? ""}
                                    placeholder="0"
                                    onChange={(e) =>
                                      setBonusDays((prev) => ({
                                        ...prev,
                                        [mod.id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {isOn ? (
                                  <span className="font-medium text-foreground">{fmt(unitPrice)}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {isOn ? (
                                  <span className="font-bold text-foreground">{fmt(total)}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              );
            })}

            {/* Uncategorized modules */}
            {modules.filter((m) => !m.category || !categories.includes(m.category)).length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Outros</h2>
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs font-semibold text-muted-foreground w-[40%]">Módulo</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[100px]">Contratado?</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[90px]">Original</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[90px]">Desconto %</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center w-[90px]">Bonif. (dias)</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[90px]">Unitário</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-right w-[110px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules
                        .filter((m) => !m.category || !categories.includes(m.category))
                        .map((mod) => {
                          const isOn = !!selected[mod.id];
                          const origPrice = getOriginalPrice(mod);
                          const unitPrice = getUnitPrice(mod);
                          const total = getModuleTotal(mod);
                          return (
                            <TableRow key={mod.id} className={cn(isOn && "bg-primary/[0.03]")}>
                              <TableCell className="py-3">
                                <p className={cn("text-sm font-semibold", isOn ? "text-foreground" : "text-muted-foreground")}>
                                  {mod.title}
                                </p>
                                {mod.description && (
                                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{mod.description}</p>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch checked={isOn} onCheckedChange={() => handleToggle(mod.id)} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmt(origPrice)}</TableCell>
                              <TableCell className="text-center">
                                {isOn ? (
                                  <Input type="number" min={0} max={50} className="h-8 w-16 mx-auto text-center text-xs tabular-nums"
                                    value={customDiscount[mod.id] ?? (autoDiscount * 100).toFixed(0)}
                                    onChange={(e) => setCustomDiscount((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                                  />
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                {isOn ? (
                                  <Input type="number" min={0} max={365} className="h-8 w-16 mx-auto text-center text-xs tabular-nums"
                                    value={bonusDays[mod.id] ?? ""} placeholder="0"
                                    onChange={(e) => setBonusDays((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                                  />
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {isOn ? <span className="font-medium text-foreground">{fmt(unitPrice)}</span> : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {isOn ? <span className="font-bold text-foreground">{fmt(total)}</span> : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Footer summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Investimento Total — {modality === "remoto" ? "Remoto" : "Presencial"}
                  </h3>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>{selectedModules.length} módulo{selectedModules.length !== 1 ? "s" : ""}</span>
                    <span>{totalHours}h total</span>
                    <span>Desconto pacote: {(autoDiscount * 100).toFixed(0)}%</span>
                  </div>
                  {grandTotalOriginal > grandTotalFinal && grandTotalFinal > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      De <span className="line-through">{fmt(grandTotalOriginal)}</span> por{" "}
                      <span className="font-bold text-primary">{fmt(grandTotalFinal)}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unitário médio</p>
                    <p className="font-display text-lg font-extrabold text-foreground tabular-nums">
                      {selectedModules.length > 0 ? fmt(grandTotalUnitAvg) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
                    <p className="font-display text-2xl font-extrabold text-primary tabular-nums">
                      {selectedModules.length > 0 ? fmt(grandTotalFinal) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedModules.length > 0 && (
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <Button
                    onClick={() => setShowRequestForm(true)}
                    className="w-full sm:w-auto"
                    size="lg"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Solicitar {selectedModules.length} módulo{selectedModules.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Request form overlay */}
        {tab === "modules" && showRequestForm && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <button
              onClick={() => setShowRequestForm(false)}
              className="text-sm text-muted-foreground font-medium mb-5 hover:text-primary flex items-center gap-1.5 transition-colors"
            >
              ← Voltar ao pacote
            </button>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="bg-gradient-nexti p-5">
                <h2 className="font-display text-lg font-bold text-primary-foreground">
                  Confirmar Solicitação
                </h2>
                <p className="text-sm text-primary-foreground/70 mt-0.5">
                  {selectedModules.length} módulo{selectedModules.length !== 1 ? "s" : ""} • {totalHours}h •{" "}
                  {modality === "remoto" ? "Remoto" : "Presencial"} • {fmt(grandTotalFinal)}
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulos selecionados</p>
                  <ul className="space-y-1">
                    {selectedModules.map((m) => (
                      <li key={m.id} className="text-sm text-foreground flex justify-between">
                        <span>{m.title}</span>
                        <span className="tabular-nums font-medium">{fmt(getModuleTotal(m))}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Data preferencial</Label>
                    <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Participantes</Label>
                    <Input
                      type="number" min={1} max={100} value={participants}
                      onChange={(e) => setParticipants(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Observações (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                    placeholder="Informações adicionais..."
                    className="mt-1"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Confirmar Solicitação
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Requests tab */}
        {tab === "requests" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {requests.length === 0 ? (
              <div className="text-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                  <Send className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Nenhuma solicitação</h3>
                <p className="text-sm text-muted-foreground mt-1">Você ainda não solicitou nenhum treinamento.</p>
                <Button onClick={() => setTab("modules")} variant="outline" className="mt-4">Ver catálogo</Button>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {requests.map((req, i) => {
                  const mod = modules.find((m) => m.id === req.module_id);
                  const st = statusConfig[req.status] || statusConfig.pending;
                  const StIcon = st.icon;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {mod?.title || "Módulo removido"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {req.preferred_date || "Sem data"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {req.participants}
                            </span>
                            <span className="flex items-center gap-1">
                              {req.modality === "remoto" ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {req.modality === "remoto" ? "Remoto" : "Presencial"}
                            </span>
                            <span className="text-muted-foreground/50">
                              {new Date(req.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          {req.admin_note && (
                            <p className="mt-2 text-xs bg-muted/50 rounded-lg p-2.5 text-muted-foreground border border-border/50">
                              <span className="font-semibold text-foreground">Resposta:</span> {req.admin_note}
                            </p>
                          )}
                        </div>
                        <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.color, st.bg)}>
                          <StIcon className="h-3 w-3" />
                          {st.label}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default TrainingPage;
