import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Clock, DollarSign, Users, CalendarDays, Send, CheckCircle2, Loader2, XCircle, AlertCircle, ChevronRight } from "lucide-react";
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

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pendente", icon: AlertCircle, color: "text-warning" },
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-success" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-primary" },
};

const TrainingPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"modules" | "requests">("modules");

  // Form state
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
      toast.success("Solicitação enviada com sucesso! O time Nexti entrará em contato.");
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

  const getPrice = (mod: TrainingModule, mod_modality: string) =>
    mod_modality === "remoto" ? Number(mod.cost_per_hour_remote) : Number(mod.cost_per_hour);

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
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              <h1 className="font-display text-xl sm:text-3xl font-extrabold text-primary-foreground">
                Treinamento Presencial
              </h1>
            </div>
            <p className="text-sm text-primary-foreground/80 max-w-xl">
              Solicite treinamento presencial ou remoto com a equipe Nexti. Escolha o módulo, a modalidade e nossa equipe entrará em contato.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-5 inline-flex rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10"
          >
            {[
              { key: "modules" as const, label: "Módulos", count: modules.length },
              { key: "requests" as const, label: "Minhas Solicitações", count: requests.length },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                  tab === key
                    ? "bg-white text-primary shadow-sm"
                    : "text-primary-foreground/70 hover:text-primary-foreground"
                )}
              >
                {label}
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 font-bold",
                  tab === key ? "bg-primary/10 text-primary" : "bg-white/15 text-primary-foreground/70"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {tab === "modules" && (
            <motion.div key="modules" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {selectedModule ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="text-sm text-primary font-semibold mb-4 hover:underline flex items-center gap-1"
                  >
                    ← Voltar aos módulos
                  </button>

                  <div className="card-surface p-5 sm:p-6 mb-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-bold text-foreground">{selectedModule.title}</h2>
                        {selectedModule.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{selectedModule.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {selectedModule.duration_hours}h de duração
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border/50 pt-5 space-y-4">
                      {/* Modality selector */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Modalidade</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            { key: "presencial" as const, label: "Presencial", price: Number(selectedModule.cost_per_hour) },
                            { key: "remoto" as const, label: "Remoto", price: Number(selectedModule.cost_per_hour_remote) },
                          ]).map(({ key, label, price }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setModality(key)}
                              className={cn(
                                "rounded-xl border-2 p-3 text-left transition-all",
                                modality === key
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-border hover:border-primary/40"
                              )}
                            >
                              <span className="text-sm font-semibold text-foreground">{label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                R$ {price.toFixed(2)}/hora
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-foreground">Custo estimado</span>
                          <span className="font-display text-lg font-extrabold text-primary">
                            R$ {(getPrice(selectedModule, modality) * selectedModule.duration_hours * participants).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedModule.duration_hours}h × R$ {getPrice(selectedModule, modality).toFixed(2)}/h × {participants} participante{participants > 1 ? "s" : ""} ({modality})
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="date" className="text-sm font-medium">Data preferencial</Label>
                        <Input
                          id="date"
                          type="date"
                          value={preferredDate}
                          onChange={(e) => setPreferredDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="participants" className="text-sm font-medium">Número de participantes</Label>
                        <Input
                          id="participants"
                          type="number"
                          min={1}
                          max={100}
                          value={participants}
                          onChange={(e) => setParticipants(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="notes" className="text-sm font-medium">Observações (opcional)</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                          placeholder="Alguma informação adicional..."
                          className="mt-1"
                          rows={3}
                          maxLength={500}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 text-right">{notes.length}/500</p>
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full"
                        size="lg"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Enviar Solicitação
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  {modules.length === 0 ? (
                    <div className="text-center py-20">
                      <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground">Nenhum módulo disponível</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Os módulos de treinamento serão adicionados em breve.
                      </p>
                    </div>
                  ) : (
                    <>
                      {categories.length > 0 && categories.map((cat) => {
                        const catModules = modules.filter((m) => m.category === cat);
                        if (catModules.length === 0) return null;
                        return (
                          <div key={cat} className="mb-8">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {catModules.map((mod, i) => (
                                <ModuleCard key={mod.id} module={mod} index={i} onSelect={setSelectedModule} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {modules.filter((m) => !m.category || !categories.includes(m.category)).length > 0 && (
                        <div className="mb-8">
                          {categories.length > 0 && (
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Outros</h2>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {modules
                              .filter((m) => !m.category || !categories.includes(m.category))
                              .map((mod, i) => (
                                <ModuleCard key={mod.id} module={mod} index={i} onSelect={setSelectedModule} />
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {tab === "requests" && (
            <motion.div key="requests" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {requests.length === 0 ? (
                <div className="text-center py-20">
                  <Send className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">Nenhuma solicitação</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você ainda não solicitou nenhum treinamento.
                  </p>
                  <Button onClick={() => setTab("modules")} className="mt-4" variant="outline">
                    Ver módulos disponíveis
                  </Button>
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
                        transition={{ delay: i * 0.05 }}
                        className="card-surface p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate">
                              {mod?.title || "Módulo removido"}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {req.preferred_date || "Sem data"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {req.participants} participante{req.participants > 1 ? "s" : ""}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {req.modality === "remoto" ? "Remoto" : "Presencial"}
                              </Badge>
                              <span className="text-muted-foreground/60">
                                {new Date(req.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            {req.admin_note && (
                              <p className="mt-2 text-xs bg-muted/50 rounded-lg p-2 text-muted-foreground border border-border/50">
                                <span className="font-semibold">Resposta:</span> {req.admin_note}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className={cn("shrink-0 gap-1", st.color)}>
                            <StIcon className="h-3 w-3" />
                            {st.label}
                          </Badge>
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

function ModuleCard({
  module,
  index,
  onSelect,
}: {
  module: TrainingModule;
  index: number;
  onSelect: (m: TrainingModule) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onSelect(module)}
      className="card-surface-hover p-4 sm:p-5 text-left group w-full"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {module.title}
          </h3>
          {module.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{module.description}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors mt-0.5" />
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {module.duration_hours}h
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">
            Presencial <strong className="text-foreground">R$ {(Number(module.cost_per_hour) * module.duration_hours).toFixed(2)}</strong>
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-muted-foreground">
            Remoto <strong className="text-foreground">R$ {(Number(module.cost_per_hour_remote) * module.duration_hours).toFixed(2)}</strong>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export default TrainingPage;
