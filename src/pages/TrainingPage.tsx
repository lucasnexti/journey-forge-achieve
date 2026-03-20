import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Clock, Users, CalendarDays, Send, CheckCircle2, Loader2,
  XCircle, AlertCircle, ChevronRight, ArrowLeft, Monitor, MapPin,
  Settings2, FileCheck, Gift, Smartphone, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  pending: { label: "Pendente", icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
};

const categoryMeta: Record<string, { icon: React.ElementType; color: string; bg: string; description: string }> = {
  "Operação": {
    icon: Settings2,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50",
    description: "Mesa de Operações — gestão de escalas, movimentações e cadastros"
  },
  "Fechamento de Folha": {
    icon: FileCheck,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50",
    description: "Nexti Time — parametrização, apuração e fechamento"
  },
  "Benefícios": {
    icon: Gift,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50",
    description: "Nexti Plus — VA, VR, VT e perfis de exceção"
  },
  "RH Digital": {
    icon: Smartphone,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50",
    description: "Produtividade — avisos, checklist, docs e automação"
  },
};

const fallbackMeta = {
  icon: Layers,
  color: "text-muted-foreground",
  bg: "bg-muted/50 border-border/50",
  description: "Módulos de treinamento avulsos"
};

const TrainingPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"modules" | "requests">("modules");

  const [preferredDate, setPreferredDate] = useState("");
  const [participants, setParticipants] = useState(1);
  const [notes, setNotes] = useState("");
  const [modality, setModality] = useState<"presencial" | "remoto">("presencial");

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

  const handleSubmit = async () => {
    if (!user || !selectedModule) return;
    if (participants < 1 || participants > 100) {
      toast.error("Número de participantes inválido.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("training_requests").insert({
      user_id: user.id,
      module_id: selectedModule.id,
      preferred_date: preferredDate || null,
      participants,
      notes: notes.trim() || null,
      modality,
    });
    if (error) {
      toast.error("Erro ao enviar solicitação: " + error.message);
    } else {
      toast.success("Solicitação enviada com sucesso!");
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles) {
        const notifications = adminRoles.map((r: any) => ({
          user_id: r.user_id,
          title: "Nova solicitação de treinamento",
          message: `${user.email} solicitou: ${selectedModule.title} (${modality}, ${participants} participantes)`,
          type: "training",
        }));
        await supabase.from("notifications").insert(notifications);
      }
      const { data: reqData } = await supabase.from("training_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setRequests((reqData as TrainingRequest[]) || []);
      setSelectedModule(null);
      setPreferredDate("");
      setParticipants(1);
      setNotes("");
      setModality("presencial");
    }
    setSubmitting(false);
  };

  const getPrice = (mod: TrainingModule, m: string) =>
    m === "remoto" ? Number(mod.cost_per_hour_remote) : Number(mod.cost_per_hour);

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
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-primary-foreground leading-tight">
                  Treinamentos
                </h1>
                <p className="text-xs sm:text-sm text-primary-foreground/70">
                  Presencial ou remoto com a equipe Nexti
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-4 mt-4"
          >
            {[
              { value: modules.length, label: "módulos" },
              { value: categories.length, label: "categorias" },
              { value: requests.filter(r => r.status === "pending").length, label: "pendentes" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="font-display text-xl font-extrabold text-primary-foreground tabular-nums">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60 font-semibold">{label}</p>
              </div>
            ))}
          </motion.div>

          {/* Tab switcher */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-5 inline-flex rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10"
          >
            {[
              { key: "modules" as const, label: "Catálogo" },
              { key: "requests" as const, label: "Minhas Solicitações" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
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
        <AnimatePresence mode="wait">
          {/* ====== MODULES TAB ====== */}
          {tab === "modules" && (
            <motion.div key="modules" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {selectedModule ? (
                <RequestForm
                  module={selectedModule}
                  modality={modality}
                  setModality={setModality}
                  preferredDate={preferredDate}
                  setPreferredDate={setPreferredDate}
                  participants={participants}
                  setParticipants={setParticipants}
                  notes={notes}
                  setNotes={setNotes}
                  submitting={submitting}
                  onSubmit={handleSubmit}
                  onBack={() => setSelectedModule(null)}
                  getPrice={getPrice}
                />
              ) : (
                <>
                  {modules.length === 0 ? (
                    <EmptyState
                      icon={GraduationCap}
                      title="Nenhum módulo disponível"
                      description="Os módulos de treinamento serão adicionados em breve."
                    />
                  ) : (
                    <div className="space-y-10">
                      {categories.map((cat, ci) => {
                        const catModules = modules.filter((m) => m.category === cat);
                        if (catModules.length === 0) return null;
                        const meta = categoryMeta[cat] || fallbackMeta;
                        const CatIcon = meta.icon;
                        return (
                          <motion.section
                            key={cat}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: ci * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          >
                            {/* Category header */}
                            <div className={cn("rounded-2xl border p-4 sm:p-5 mb-4", meta.bg)}>
                              <div className="flex items-center gap-3">
                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", meta.color, "bg-white/80 dark:bg-white/10")}>
                                  <CatIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h2 className="font-display text-base font-bold text-foreground">{cat}</h2>
                                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                                </div>
                                <Badge variant="secondary" className="ml-auto text-[10px] font-bold">
                                  {catModules.length} módulo{catModules.length > 1 ? "s" : ""}
                                </Badge>
                              </div>
                            </div>

                            {/* Module cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {catModules.map((mod, i) => (
                                <ModuleCard
                                  key={mod.id}
                                  module={mod}
                                  index={i}
                                  onSelect={setSelectedModule}
                                  catColor={meta.color}
                                />
                              ))}
                            </div>
                          </motion.section>
                        );
                      })}

                      {/* Uncategorized */}
                      {modules.filter((m) => !m.category || !categories.includes(m.category)).length > 0 && (
                        <section>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Outros</h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {modules
                              .filter((m) => !m.category || !categories.includes(m.category))
                              .map((mod, i) => (
                                <ModuleCard key={mod.id} module={mod} index={i} onSelect={setSelectedModule} />
                              ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ====== REQUESTS TAB ====== */}
          {tab === "requests" && (
            <motion.div key="requests" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {requests.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="Nenhuma solicitação"
                  description="Você ainda não solicitou nenhum treinamento."
                  action={<Button onClick={() => setTab("modules")} variant="outline" className="mt-4">Ver catálogo</Button>}
                />
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
                        className="card-surface p-4 sm:p-5"
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
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

/* ========== Module Card ========== */
function ModuleCard({
  module,
  index,
  onSelect,
  catColor,
}: {
  module: TrainingModule;
  index: number;
  onSelect: (m: TrainingModule) => void;
  catColor?: string;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(module)}
      className="card-surface-hover p-4 text-left group w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
          {module.title}
        </h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5" />
      </div>

      {module.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{module.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{module.duration_hours}h</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <strong className="text-foreground font-semibold tabular-nums">R$ {(Number(module.cost_per_hour) * module.duration_hours).toFixed(0)}</strong>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Monitor className="h-3 w-3" />
            <strong className="text-foreground font-semibold tabular-nums">R$ {(Number(module.cost_per_hour_remote) * module.duration_hours).toFixed(0)}</strong>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

/* ========== Request Form ========== */
function RequestForm({
  module,
  modality,
  setModality,
  preferredDate,
  setPreferredDate,
  participants,
  setParticipants,
  notes,
  setNotes,
  submitting,
  onSubmit,
  onBack,
  getPrice,
}: {
  module: TrainingModule;
  modality: "presencial" | "remoto";
  setModality: (m: "presencial" | "remoto") => void;
  preferredDate: string;
  setPreferredDate: (v: string) => void;
  participants: number;
  setParticipants: (v: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
  getPrice: (mod: TrainingModule, m: string) => number;
}) {
  const price = getPrice(module, modality);
  const total = price * module.duration_hours * participants;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground font-medium mb-5 hover:text-primary flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao catálogo
      </button>

      <div className="card-surface overflow-hidden">
        {/* Module header */}
        <div className="bg-gradient-nexti p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-primary-foreground">{module.title}</h2>
              {module.description && (
                <p className="text-sm text-primary-foreground/70 mt-0.5">{module.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-primary-foreground/60">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {module.duration_hours}h
                </span>
                {module.category && (
                  <Badge variant="secondary" className="bg-white/15 text-primary-foreground border-0 text-[10px]">
                    {module.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Modality selector */}
          <div>
            <Label className="text-sm font-semibold mb-3 block text-foreground">Modalidade</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "presencial" as const, label: "Presencial", icon: MapPin, price: Number(module.cost_per_hour), desc: "Na sua empresa" },
                { key: "remoto" as const, label: "Remoto", icon: Monitor, price: Number(module.cost_per_hour_remote), desc: "Via videoconferência" },
              ]).map(({ key, label, icon: Icon, price: p, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModality(key)}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all group",
                    modality === key
                      ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", modality === key ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-semibold", modality === key ? "text-primary" : "text-foreground")}>{label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                  <p className="text-base font-display font-extrabold text-foreground mt-2 tabular-nums">
                    R$ {p.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/hora</span>
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Cost estimate */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">Investimento estimado</span>
              <span className="font-display text-2xl font-extrabold text-primary tabular-nums">
                R$ {total.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {module.duration_hours}h × R$ {price.toFixed(2)}/h × {participants} participante{participants > 1 ? "s" : ""} • {modality}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-sm font-medium">Data preferencial</Label>
              <Input
                id="date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="participants" className="text-sm font-medium">Participantes</Label>
              <Input
                id="participants"
                type="number"
                min={1}
                max={100}
                value={participants}
                onChange={(e) => setParticipants(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Alguma informação adicional sobre o treinamento..."
              className="mt-1.5"
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">{notes.length}/500</p>
          </div>

          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Solicitar Treinamento
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ========== Empty State ========== */
function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {action}
    </div>
  );
}

export default TrainingPage;
