import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTrainingModules, useTrainingRequests } from "@/hooks/useDashboardData";
import { queryKeys } from "@/hooks/useQueryKeys";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Clock, Users, CalendarDays, Send, CheckCircle2, Loader2,
  XCircle, AlertCircle, Monitor, MapPin, Package, ChevronDown, BookOpen,
  Layers, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const categoryConfig: Record<string, { icon: React.ElementType; color: string; gradient: string }> = {
  "Nexti Prime": { icon: Layers, color: "text-blue-600", gradient: "from-blue-500/10 to-blue-500/5" },
  "Fechamento de Folha": { icon: BookOpen, color: "text-purple-600", gradient: "from-purple-500/10 to-purple-500/5" },
  "Benefícios": { icon: Package, color: "text-emerald-600", gradient: "from-emerald-500/10 to-emerald-500/5" },
  "RH Digital": { icon: Monitor, color: "text-amber-600", gradient: "from-amber-500/10 to-amber-500/5" },
};

const TrainingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: modulesRaw = [], isLoading: modulesLoading } = useTrainingModules();
  const { data: requestsRaw = [], isLoading: requestsLoading } = useTrainingRequests();

  const modules = modulesRaw as TrainingModule[];
  const requests = requestsRaw as TrainingRequest[];
  const loading = modulesLoading || requestsLoading;

  const [tab, setTab] = useState<"modules" | "requests">("modules");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [modalities, setModalities] = useState<Record<string, "presencial" | "remoto">>({});
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [participants, setParticipants] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // "completa" = all modules in category, "avulsa" = individual selection
  const [categoryMode, setCategoryMode] = useState<Record<string, "completa" | "avulsa">>({});

  const categories = useMemo(
    () => [...new Set(modules.map((m) => m.category).filter(Boolean))] as string[],
    [modules]
  );

  // Auto-expand all categories on mount
  useMemo(() => {
    if (categories.length > 0 && Object.keys(expandedCategories).length === 0) {
      const initial: Record<string, boolean> = {};
      categories.forEach((c) => { initial[c] = true; });
      setExpandedCategories(initial);
    }
  }, [categories]);

  const handleCategoryMode = (cat: string, mode: "completa" | "avulsa") => {
    setCategoryMode((prev) => ({ ...prev, [cat]: mode }));
    const catMods = modules.filter((m) => m.category === cat);
    if (mode === "completa") {
      // Select all modules in category
      const next = { ...selected };
      catMods.forEach((m) => { next[m.id] = true; });
      setSelected(next);
    } else {
      // Deselect all modules in category
      const next = { ...selected };
      catMods.forEach((m) => { next[m.id] = false; });
      setSelected(next);
      const nextMod = { ...modalities };
      catMods.forEach((m) => { delete nextMod[m.id]; });
      setModalities(nextMod);
    }
  };

  const selectedModules = useMemo(() => modules.filter((m) => selected[m.id]), [modules, selected]);
  const readyModules = useMemo(() => selectedModules.filter((m) => !!modalities[m.id]), [selectedModules, modalities]);
  const totalHours = useMemo(() => readyModules.reduce((sum, m) => sum + m.duration_hours, 0), [readyModules]);
  const autoDiscount = getDiscountForHours(totalHours);

  const getModModality = (mod: TrainingModule) => modalities[mod.id] || null;
  const hasModality = (mod: TrainingModule) => !!modalities[mod.id];
  const getOriginalPrice = (mod: TrainingModule) =>
    modalities[mod.id] === "remoto" ? Number(mod.cost_per_hour_remote) : Number(mod.cost_per_hour);
  const getUnitPrice = (mod: TrainingModule) => getOriginalPrice(mod) * (1 - autoDiscount);
  const getModuleTotal = (mod: TrainingModule) => getUnitPrice(mod) * mod.duration_hours;

  const grandTotalOriginal = readyModules.reduce((s, m) => s + getOriginalPrice(m) * m.duration_hours, 0);
  const grandTotalFinal = readyModules.reduce((s, m) => s + getModuleTotal(m), 0);

  const handleToggle = (id: string) => {
    const next = !selected[id];
    setSelected((prev) => ({ ...prev, [id]: next }));
    if (!next) setModalities((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSubmit = async () => {
    if (!user || readyModules.length === 0) return;
    setSubmitting(true);
    const inserts = readyModules.map((mod) => ({
      user_id: user.id, module_id: mod.id, preferred_date: preferredDate || null,
      participants, notes: notes.trim() || null, modality: modalities[mod.id],
    }));
    const { error } = await supabase.from("training_requests").insert(inserts);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
    } else {
      toast.success(`${readyModules.length} módulo(s) solicitado(s) com sucesso!`);
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles) {
        await supabase.from("notifications").insert(
          adminRoles.map((r: any) => ({
            user_id: r.user_id, title: "Nova solicitação de treinamento",
            message: `${user.email} solicitou ${readyModules.length} módulo(s) — ${participants} participantes, total ${fmt(grandTotalFinal)}`,
            type: "training",
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.training.requests(user.id) });
      setSelected({});
      setModalities({});
      setShowRequestForm(false);
      setPreferredDate("");
      setParticipants(1);
      setNotes("");
      setTab("requests");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const getSelectedCountForCategory = (cat: string) => {
    const catMods = modules.filter((m) => m.category === cat);
    return catMods.filter((m) => selected[m.id]).length;
  };

  const getCategoryTotalHours = (cat: string) => {
    const catMods = modules.filter((m) => m.category === cat);
    return catMods.reduce((s, m) => s + m.duration_hours, 0);
  };

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

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="mt-5 inline-flex rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10"
          >
            {([
              { key: "modules" as const, label: "Montar Pacote" },
              { key: "requests" as const, label: "Minhas Solicitações" },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => { setTab(key); setShowRequestForm(false); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  tab === key ? "bg-white text-primary shadow-sm" : "text-primary-foreground/70 hover:text-primary-foreground"
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
            {/* Info bar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {totalHours > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Package className="h-3 w-3" />
                  {totalHours}h selecionada{totalHours > 1 ? "s" : ""} — desconto {(autoDiscount * 100).toFixed(0)}%
                </Badge>
              )}
              {/* Discount tiers */}
              <div className="flex flex-wrap gap-1.5">
                {discountTiers.map((tier) => (
                  <div key={tier.minHours}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors",
                      totalHours >= tier.minHours
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted/50 text-muted-foreground border-border/50"
                    )}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {tier.minHours}h+ → {tier.label}
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ MODULE GROUPS (Accordion) ═══ */}
            <div className="space-y-4">
              {categories.map((cat, ci) => {
                const catModules = modules.filter((m) => m.category === cat);
                if (catModules.length === 0) return null;
                const isExpanded = expandedCategories[cat] !== false;
                const cfg = categoryConfig[cat] || { icon: Package, color: "text-muted-foreground", gradient: "from-muted/50 to-muted/20" };
                const CatIcon = cfg.icon;
                const catTotalHours = getCategoryTotalHours(cat);
                const mode = categoryMode[cat]; // undefined = not chosen yet
                const selectedCount = getSelectedCountForCategory(cat);

                return (
                  <motion.div key={cat}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: ci * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left transition-colors hover:bg-muted/30",
                        "bg-gradient-to-r", cfg.gradient
                      )}
                    >
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0 bg-background/80 border border-border/50", cfg.color)}>
                        <CatIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-foreground">{cat}</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {catModules.length} plano{catModules.length > 1 ? "s" : ""} · {catTotalHours}h total
                        </p>
                      </div>
                      {selectedCount > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold mr-2">
                          {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )} />
                    </button>

                    {/* Category Content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          {/* Mode selector */}
                          <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/20">
                            <p className="text-[11px] text-muted-foreground font-medium mb-2">Tipo de solicitação:</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              {/* Reimplantação Completa */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCategoryMode(cat, "completa"); }}
                                className={cn(
                                  "flex-1 flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                                  mode === "completa"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/40 bg-background"
                                )}
                              >
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                                  mode === "completa" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                  <Layers className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className={cn("text-sm font-bold", mode === "completa" ? "text-foreground" : "text-muted-foreground")}>
                                    Completa
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Todos os {catModules.length} módulos · <span className="font-semibold">{catTotalHours}h</span>
                                  </p>
                                </div>
                                {mode === "completa" && (
                                  <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                                )}
                              </button>

                              {/* Solicitações Avulsas */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCategoryMode(cat, "avulsa"); }}
                                className={cn(
                                  "flex-1 flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                                  mode === "avulsa"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/40 bg-background"
                                )}
                              >
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                                  mode === "avulsa" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                  <BookOpen className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className={cn("text-sm font-bold", mode === "avulsa" ? "text-foreground" : "text-muted-foreground")}>
                                    Solicitações Avulsas
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Selecione módulos individuais por horas
                                  </p>
                                </div>
                                {mode === "avulsa" && (
                                  <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Completa mode: show all modules with modality selector */}
                          {mode === "completa" && (
                            <div className="px-4 sm:px-5 py-3 bg-primary/[0.02]">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="text-sm font-bold text-foreground">Pacote completo selecionado</p>
                                  <p className="text-[11px] text-muted-foreground">{catModules.length} módulos · {catTotalHours}h</p>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {catModules.map((mod) => (
                                  <div key={mod.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/30">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="text-foreground font-medium">{mod.title}</span>
                                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">{mod.duration_hours}h</Badge>
                                    </div>
                                    {/* Inline modality */}
                                    <div className="inline-flex rounded-md border border-border bg-background p-0.5 gap-0.5">
                                      {([
                                        { key: "presencial" as const, icon: MapPin },
                                        { key: "remoto" as const, icon: Monitor },
                                      ]).map(({ key, icon: Icon }) => (
                                        <button key={key}
                                          onClick={() => setModalities((prev) => ({ ...prev, [mod.id]: key }))}
                                          className={cn(
                                            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                                            modalities[mod.id] === key
                                              ? "bg-primary text-primary-foreground shadow-sm"
                                              : "text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          <Icon className="h-3 w-3" />
                                          {key === "presencial" ? "Presencial" : "Remoto"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Avulsa mode: individual toggles */}
                          {mode === "avulsa" && (
                            <div className="divide-y divide-border">
                              {catModules.map((mod) => {
                                const isOn = !!selected[mod.id];
                                const modMod = getModModality(mod);
                                const origPrice = getOriginalPrice(mod);
                                const total = getModuleTotal(mod);

                                return (
                                  <div key={mod.id}
                                    className={cn(
                                      "px-4 sm:px-5 py-3.5 transition-colors",
                                      isOn ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className={cn("text-sm font-semibold leading-snug", isOn ? "text-foreground" : "text-muted-foreground")}>
                                            {mod.title}
                                          </p>
                                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                                            {mod.duration_hours}h
                                          </Badge>
                                        </div>
                                        {mod.description && (
                                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{mod.description}</p>
                                        )}
                                      </div>
                                      <div className="shrink-0">
                                        <Switch checked={isOn} onCheckedChange={() => handleToggle(mod.id)} />
                                      </div>
                                    </div>

                                    <AnimatePresence>
                                      {isOn && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center gap-3">
                                            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
                                              {([
                                                { key: "presencial" as const, label: "Presencial", icon: MapPin, price: mod.cost_per_hour },
                                                { key: "remoto" as const, label: "Remoto", icon: Monitor, price: mod.cost_per_hour_remote },
                                              ]).map(({ key, label, icon: Icon, price }) => (
                                                <button
                                                  key={key}
                                                  onClick={() => setModalities((prev) => ({ ...prev, [mod.id]: key }))}
                                                  className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                                                    modMod === key
                                                      ? "bg-primary text-primary-foreground shadow-sm"
                                                      : "text-muted-foreground hover:text-foreground"
                                                  )}
                                                >
                                                  <Icon className="h-3 w-3" />
                                                  {label}
                                                  <span className="opacity-70">({fmt(Number(price))})</span>
                                                </button>
                                              ))}
                                            </div>
                                            {hasModality(mod) && (
                                              <div className="flex items-center gap-2 ml-auto">
                                                {autoDiscount > 0 && (
                                                  <span className="text-[10px] text-muted-foreground line-through">
                                                    {fmt(origPrice * mod.duration_hours)}
                                                  </span>
                                                )}
                                                <span className="text-sm font-bold text-primary tabular-nums">
                                                  {fmt(total)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {/* Uncategorized */}
              {modules.filter((m) => !m.category || !categories.includes(m.category)).length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  <div className="px-4 sm:px-5 py-3 bg-muted/30">
                    <h2 className="text-sm font-bold text-muted-foreground">Outros</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {modules.filter((m) => !m.category || !categories.includes(m.category)).map((mod) => {
                      const isOn = !!selected[mod.id];
                      return (
                        <div key={mod.id} className={cn("px-4 sm:px-5 py-3.5", isOn && "bg-primary/[0.03]")}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{mod.title}</p>
                              <span className="text-[10px] text-muted-foreground">{mod.duration_hours}h</span>
                            </div>
                            <Switch checked={isOn} onCheckedChange={() => handleToggle(mod.id)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-6 rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Investimento Total</h3>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>{readyModules.length} módulo{readyModules.length !== 1 ? "s" : ""}</span>
                    <span>{totalHours}h total</span>
                  </div>
                  {autoDiscount > 0 && readyModules.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                        Desconto pacote: {(autoDiscount * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        De <span className="line-through">{fmt(grandTotalOriginal)}</span> por{" "}
                        <span className="font-bold text-primary">{fmt(grandTotalFinal)}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
                  <p className="font-display text-2xl font-extrabold text-primary tabular-nums">
                    {readyModules.length > 0 ? fmt(grandTotalFinal) : "—"}
                  </p>
                </div>
              </div>

              {readyModules.length > 0 && (
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <Button onClick={() => setShowRequestForm(true)} className="w-full sm:w-auto" size="lg">
                    <Send className="h-4 w-4 mr-2" />
                    Solicitar {readyModules.length} módulo{readyModules.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Request form */}
        {tab === "modules" && showRequestForm && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <button onClick={() => setShowRequestForm(false)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            <div className="card-surface p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Confirmar Solicitação</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {readyModules.length} módulo{readyModules.length !== 1 ? "s" : ""} · {totalHours}h · {fmt(grandTotalFinal)}
                </p>
              </div>

              {/* Selected summary */}
              <div className="space-y-2">
                {readyModules.map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                    <div>
                      <span className="font-medium text-foreground">{mod.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {modalities[mod.id] === "remoto" ? "Remoto" : "Presencial"} · {mod.duration_hours}h
                      </span>
                    </div>
                    <span className="font-bold text-primary tabular-nums">{fmt(getModuleTotal(mod))}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Data preferencial</Label>
                  <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nº de participantes</Label>
                  <Input type="number" min={1} value={participants} onChange={(e) => setParticipants(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea placeholder="Necessidades especiais, horários, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar Solicitação
              </Button>
            </div>
          </motion.div>
        )}

        {/* Requests tab */}
        {tab === "requests" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {requests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhuma solicitação ainda</p>
                <p className="text-xs mt-1">Monte seu pacote na aba "Montar Pacote"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const mod = modules.find((m) => m.id === req.module_id);
                  const cfg = statusConfig[req.status] || statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={req.id} className="card-surface p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{mod?.title || "Módulo"}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          {req.modality === "remoto" ? (
                            <span className="flex items-center gap-0.5"><Monitor className="h-3 w-3" /> Remoto</span>
                          ) : (
                            <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> Presencial</span>
                          )}
                          <span>· {req.participants} participante{req.participants > 1 ? "s" : ""}</span>
                          {req.preferred_date && <span>· {new Date(req.preferred_date).toLocaleDateString("pt-BR")}</span>}
                          <span>· {new Date(req.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        {req.admin_note && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 bg-muted/30 rounded px-2 py-1 italic">
                            💬 {req.admin_note}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-xs gap-1", cfg.bg, cfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
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
