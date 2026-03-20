import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, GraduationCap, Clock, Users, Loader2,
  Search, Filter, CheckCircle2, XCircle, AlertCircle, MapPin, Monitor,
  CalendarDays, MessageSquare, Package, ChevronDown, ChevronUp, Eye
} from "lucide-react";
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
  order_index: number;
}

interface TrainingRequest {
  id: string;
  user_id: string;
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
  pending: { label: "Pendente", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
};

const defaultCategories = ["Operação", "Fechamento de Folha", "Benefícios", "RH Digital"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const AdminTreinamentoPresencial = () => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"modules" | "requests">("modules");

  // Module form
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", duration_hours: "1",
    cost_per_hour: "400", cost_per_hour_remote: "200",
    category: "", is_active: true, order_index: "0",
  });

  // Request management
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondingRequest, setRespondingRequest] = useState<TrainingRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [respondStatus, setRespondStatus] = useState("approved");

  // Filters
  const [searchModules, setSearchModules] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchRequests, setSearchRequests] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Detail view
  const [detailRequest, setDetailRequest] = useState<TrainingRequest | null>(null);

  // Sort
  const [sortModules, setSortModules] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "order_index", dir: "asc" });

  const fetchAll = async () => {
    const [{ data: modData }, { data: reqData }, { data: profData }] = await Promise.all([
      supabase.from("training_modules").select("*").order("order_index"),
      supabase.from("training_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    setModules((modData as TrainingModule[]) || []);
    setRequests((reqData as TrainingRequest[]) || []);
    const pMap: Record<string, string> = {};
    (profData || []).forEach((p: any) => { pMap[p.user_id] = p.nome; });
    setProfiles(pMap);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ===== Module CRUD =====
  const openNewModule = () => {
    setEditingModule(null);
    setForm({
      title: "", description: "", duration_hours: "1",
      cost_per_hour: "400", cost_per_hour_remote: "200",
      category: "", is_active: true, order_index: String(modules.length),
    });
    setModuleDialogOpen(true);
  };

  const openEditModule = (mod: TrainingModule) => {
    setEditingModule(mod);
    setForm({
      title: mod.title,
      description: mod.description || "",
      duration_hours: String(mod.duration_hours),
      cost_per_hour: String(mod.cost_per_hour),
      cost_per_hour_remote: String(mod.cost_per_hour_remote),
      category: mod.category || "",
      is_active: mod.is_active,
      order_index: String(mod.order_index),
    });
    setModuleDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration_hours: parseFloat(form.duration_hours) || 1,
      cost_per_hour: parseFloat(form.cost_per_hour) || 0,
      cost_per_hour_remote: parseFloat(form.cost_per_hour_remote) || 0,
      category: form.category.trim() || null,
      is_active: form.is_active,
      order_index: parseInt(form.order_index) || 0,
    };

    if (editingModule) {
      const { error } = await supabase.from("training_modules").update(payload).eq("id", editingModule.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Módulo atualizado!");
    } else {
      const { error } = await supabase.from("training_modules").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Módulo criado!");
    }
    setModuleDialogOpen(false);
    fetchAll();
  };

  const handleDeleteModule = async (mod: TrainingModule) => {
    if (!confirm(`Excluir o módulo "${mod.title}"?`)) return;
    const { error } = await supabase.from("training_modules").delete().eq("id", mod.id);
    if (error) toast.error(error.message);
    else { toast.success("Módulo excluído!"); fetchAll(); }
  };

  const handleToggleActive = async (mod: TrainingModule) => {
    const { error } = await supabase.from("training_modules").update({ is_active: !mod.is_active }).eq("id", mod.id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  // ===== Request management =====
  const openRespondDialog = (req: TrainingRequest) => {
    setRespondingRequest(req);
    setRespondStatus("approved");
    setAdminNote(req.admin_note || "");
    setRespondDialogOpen(true);
  };

  const handleRespond = async () => {
    if (!respondingRequest) return;
    const { error } = await supabase
      .from("training_requests")
      .update({ status: respondStatus, admin_note: adminNote.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", respondingRequest.id);
    if (error) { toast.error(error.message); return; }

    // Notify user
    await supabase.from("notifications").insert({
      user_id: respondingRequest.user_id,
      title: `Treinamento ${respondStatus === "approved" ? "aprovado" : respondStatus === "rejected" ? "recusado" : "concluído"}`,
      message: `Sua solicitação de treinamento foi ${statusConfig[respondStatus]?.label.toLowerCase() || respondStatus}.${adminNote.trim() ? ` Nota: ${adminNote.trim()}` : ""}`,
      type: "training",
    });

    toast.success("Resposta enviada e usuário notificado!");
    setRespondDialogOpen(false);
    fetchAll();
  };

  // ===== Filtered data =====
  const filteredModules = useMemo(() => {
    let result = [...modules];
    if (searchModules) {
      const q = searchModules.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q));
    }
    if (filterCategory !== "all") {
      result = result.filter((m) => m.category === filterCategory);
    }
    // Sort
    result.sort((a, b) => {
      const key = sortModules.key as keyof TrainingModule;
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortModules.dir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [modules, searchModules, filterCategory, sortModules]);

  const filteredRequests = useMemo(() => {
    let result = [...requests];
    if (searchRequests) {
      const q = searchRequests.toLowerCase();
      result = result.filter((r) => {
        const mod = modules.find((m) => m.id === r.module_id);
        const name = profiles[r.user_id] || "";
        return mod?.title.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      });
    }
    if (filterStatus !== "all") {
      result = result.filter((r) => r.status === filterStatus);
    }
    return result;
  }, [requests, searchRequests, filterStatus, modules, profiles]);

  const categories = useMemo(
    () => [...new Set(modules.map((m) => m.category).filter(Boolean))] as string[],
    [modules]
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const toggleSort = (key: string) => {
    setSortModules((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortModules.key !== col) return null;
    return sortModules.dir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
  };

  if (loading) {
    return <AdminLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-primary-foreground leading-tight">
                Gestão de Treinamentos
              </h1>
              <p className="text-xs text-primary-foreground/70">Módulos, solicitações e precificação</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-4">
            {[
              { value: modules.length, label: "módulos" },
              { value: modules.filter((m) => m.is_active).length, label: "ativos" },
              { value: requests.length, label: "solicitações" },
              { value: pendingCount, label: "pendentes" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="font-display text-xl font-extrabold text-primary-foreground tabular-nums">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60 font-semibold">{label}</p>
              </div>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="inline-flex rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10">
            {[
              { key: "modules" as const, label: "Módulos", count: modules.length },
              { key: "requests" as const, label: "Solicitações", count: pendingCount },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                  tab === key ? "bg-white text-primary shadow-sm" : "text-primary-foreground/70 hover:text-primary-foreground"
                )}
              >
                {label}
                {key === "requests" && count > 0 && (
                  <span className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold px-1",
                    tab === key ? "bg-primary text-primary-foreground" : "bg-white/20 text-primary-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          {/* ===== MODULES TAB ===== */}
          {tab === "modules" && (
            <motion.div key="modules" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar módulo..."
                    value={searchModules}
                    onChange={(e) => setSearchModules(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={openNewModule} className="ml-auto">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Novo Módulo
                </Button>
              </div>

              {/* Modules table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold cursor-pointer select-none" onClick={() => toggleSort("order_index")}>
                        # <SortIcon col="order_index" />
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none" onClick={() => toggleSort("title")}>
                        Módulo <SortIcon col="title" />
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none" onClick={() => toggleSort("category")}>
                        Categoria <SortIcon col="category" />
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[70px]">Duração</TableHead>
                      <TableHead className="text-xs font-semibold text-right w-[110px]">Presencial/h</TableHead>
                      <TableHead className="text-xs font-semibold text-right w-[110px]">Remoto/h</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[70px]">Ativo</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          {searchModules || filterCategory !== "all"
                            ? "Nenhum módulo encontrado com esses filtros."
                            : "Nenhum módulo cadastrado. Clique em \"Novo Módulo\" para começar."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredModules.map((mod) => (
                        <TableRow key={mod.id} className={cn("transition-colors", !mod.is_active && "opacity-50")}>
                          <TableCell className="tabular-nums text-xs text-muted-foreground font-mono">{mod.order_index}</TableCell>
                          <TableCell className="py-3">
                            <p className="text-sm font-semibold text-foreground leading-snug">{mod.title}</p>
                            {mod.description && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{mod.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {mod.category ? (
                              <Badge variant="secondary" className="text-[10px] font-medium">{mod.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-sm">{mod.duration_hours}h</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(Number(mod.cost_per_hour))}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(Number(mod.cost_per_hour_remote))}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={mod.is_active} onCheckedChange={() => handleToggleActive(mod)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditModule(mod)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteModule(mod)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                {filteredModules.length} módulo{filteredModules.length !== 1 ? "s" : ""} exibido{filteredModules.length !== 1 ? "s" : ""}
              </p>
            </motion.div>
          )}

          {/* ===== REQUESTS TAB ===== */}
          {tab === "requests" && (
            <motion.div key="requests" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por módulo ou usuário..."
                    value={searchRequests}
                    onChange={(e) => setSearchRequests(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Requests table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold">Módulo</TableHead>
                      <TableHead className="text-xs font-semibold">Solicitante</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[90px]">Modalidade</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[90px]">Participantes</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[100px]">Data pref.</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[90px]">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[80px]">Data</TableHead>
                      <TableHead className="text-xs font-semibold text-center w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          Nenhuma solicitação encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((req) => {
                        const mod = modules.find((m) => m.id === req.module_id);
                        const st = statusConfig[req.status] || statusConfig.pending;
                        const StIcon = st.icon;
                        return (
                          <TableRow key={req.id} className="transition-colors">
                            <TableCell className="py-3">
                              <p className="text-sm font-semibold text-foreground leading-snug">
                                {mod?.title || "Módulo removido"}
                              </p>
                              {req.notes && (
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3 shrink-0" />
                                  {req.notes}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium text-foreground">{profiles[req.user_id] || "Desconhecido"}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[10px] gap-1">
                                {req.modality === "remoto" ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                {req.modality === "remoto" ? "Remoto" : "Presencial"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-sm">
                              {req.participants}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {req.preferred_date || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border", st.color, st.bg)}>
                                <StIcon className="h-3 w-3" />
                                {st.label}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                              {new Date(req.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailRequest(req)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {req.status === "pending" && (
                                  <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => openRespondDialog(req)}>
                                    Responder
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                {filteredRequests.length} solicitação(ões) exibida(s)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== MODULE DIALOG ===== */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
            <DialogDescription>
              {editingModule ? "Atualize as informações do módulo de treinamento." : "Preencha os dados para criar um novo módulo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-medium">Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Categoria</Label>
                <Select value={form.category || "__none"} onValueChange={(v) => setForm({ ...form, category: v === "__none" ? "" : v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem categoria</SelectItem>
                    {defaultCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Ordem</Label>
                <Input type="number" min="0" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Duração (horas)</Label>
                <Input type="number" min="0.5" step="0.5" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Custo/h Presencial (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.cost_per_hour} onChange={(e) => setForm({ ...form, cost_per_hour: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Custo/h Remoto (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.cost_per_hour_remote} onChange={(e) => setForm({ ...form, cost_per_hour_remote: e.target.value })} className="mt-1" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  Ativo
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveModule}>
              {editingModule ? "Salvar Alterações" : "Criar Módulo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RESPOND DIALOG ===== */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Responder Solicitação</DialogTitle>
            <DialogDescription>
              {respondingRequest && (
                <>
                  {modules.find((m) => m.id === respondingRequest.module_id)?.title || "Módulo"} —{" "}
                  {profiles[respondingRequest.user_id] || "Usuário"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium mb-2 block">Status</Label>
              <div className="flex gap-2">
                {([
                  { key: "approved", label: "Aprovar", icon: CheckCircle2, color: "text-emerald-600" },
                  { key: "rejected", label: "Recusar", icon: XCircle, color: "text-red-600" },
                  { key: "completed", label: "Concluído", icon: CheckCircle2, color: "text-primary" },
                ]).map(({ key, label, icon: Icon, color }) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={respondStatus === key ? "default" : "outline"}
                    onClick={() => setRespondStatus(key)}
                    className="gap-1.5"
                  >
                    <Icon className={cn("h-3.5 w-3.5", respondStatus !== key && color)} />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Nota para o solicitante (opcional)</Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value.slice(0, 500))}
                placeholder="Ex: Treinamento agendado para 15/04..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRespond}>Enviar Resposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={!!detailRequest} onOpenChange={() => setDetailRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>Informações completas do pedido de treinamento.</DialogDescription>
          </DialogHeader>

          {detailRequest && (() => {
            const mod = modules.find((m) => m.id === detailRequest.module_id);
            const st = statusConfig[detailRequest.status] || statusConfig.pending;
            const StIcon = st.icon;
            const price = detailRequest.modality === "remoto"
              ? Number(mod?.cost_per_hour_remote || 0)
              : Number(mod?.cost_per_hour || 0);
            const total = price * (mod?.duration_hours || 0) * detailRequest.participants;

            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Módulo</p>
                    <p className="font-semibold text-foreground">{mod?.title || "Removido"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Solicitante</p>
                    <p className="font-semibold text-foreground">{profiles[detailRequest.user_id] || "Desconhecido"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Modalidade</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {detailRequest.modality === "remoto" ? <Monitor className="h-3.5 w-3.5 text-muted-foreground" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>{detailRequest.modality === "remoto" ? "Remoto" : "Presencial"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Participantes</p>
                    <p className="font-semibold tabular-nums">{detailRequest.participants}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data preferencial</p>
                    <p>{detailRequest.preferred_date || "Não definida"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Solicitado em</p>
                    <p className="tabular-nums">{new Date(detailRequest.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                    <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border mt-0.5", st.color, st.bg)}>
                      <StIcon className="h-3 w-3" />
                      {st.label}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estimativa</p>
                    <p className="font-bold text-primary tabular-nums">{fmt(total)}</p>
                  </div>
                </div>

                {detailRequest.notes && (
                  <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Observações do usuário</p>
                    <p className="text-sm text-foreground">{detailRequest.notes}</p>
                  </div>
                )}
                {detailRequest.admin_note && (
                  <div className="rounded-lg bg-primary/5 p-3 border border-primary/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Resposta do admin</p>
                    <p className="text-sm text-foreground">{detailRequest.admin_note}</p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            {detailRequest?.status === "pending" && (
              <Button onClick={() => { setDetailRequest(null); if (detailRequest) openRespondDialog(detailRequest); }}>
                Responder
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailRequest(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTreinamentoPresencial;
