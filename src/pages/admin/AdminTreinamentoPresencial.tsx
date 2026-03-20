import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, CheckCircle2, XCircle, AlertCircle, Clock, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  duration_hours: number;
  cost_per_hour: number;
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
}

const AdminTreinamentoPresencial = () => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"modules" | "requests">("modules");

  // Module form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", duration_hours: "1", cost_per_hour: "0", category: "", is_active: true });

  // Request response
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [respondStatus, setRespondStatus] = useState("approved");

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

  const handleSaveModule = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration_hours: parseFloat(form.duration_hours) || 1,
      cost_per_hour: parseFloat(form.cost_per_hour) || 0,
      category: form.category.trim() || null,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase.from("training_modules").update(payload).eq("id", editingId);
      if (error) toast.error(error.message); else toast.success("Módulo atualizado!");
    } else {
      const { error } = await supabase.from("training_modules").insert(payload);
      if (error) toast.error(error.message); else toast.success("Módulo criado!");
    }
    resetForm();
    fetchAll();
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Excluir este módulo?")) return;
    const { error } = await supabase.from("training_modules").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Módulo excluído!"); fetchAll(); }
  };

  const handleEditModule = (mod: TrainingModule) => {
    setEditingId(mod.id);
    setForm({
      title: mod.title,
      description: mod.description || "",
      duration_hours: String(mod.duration_hours),
      cost_per_hour: String(mod.cost_per_hour),
      category: mod.category || "",
      is_active: mod.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ title: "", description: "", duration_hours: "1", cost_per_hour: "0", category: "", is_active: true });
  };

  const handleRespond = async (reqId: string) => {
    const { error } = await supabase
      .from("training_requests")
      .update({ status: respondStatus, admin_note: adminNote.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", reqId);
    if (error) toast.error(error.message);
    else { toast.success("Resposta enviada!"); setRespondingId(null); setAdminNote(""); fetchAll(); }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "text-warning bg-warning/10 border-warning/20" },
    approved: { label: "Aprovado", color: "text-success bg-success/10 border-success/20" },
    rejected: { label: "Recusado", color: "text-destructive bg-destructive/10 border-destructive/20" },
    completed: { label: "Concluído", color: "text-primary bg-primary/10 border-primary/20" },
  };

  if (loading) {
    return <AdminLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={tab === "modules" ? "default" : "outline"} size="sm" onClick={() => setTab("modules")}>
          Módulos ({modules.length})
        </Button>
        <Button variant={tab === "requests" ? "default" : "outline"} size="sm" onClick={() => setTab("requests")}>
          Solicitações ({requests.filter(r => r.status === "pending").length} pendentes)
        </Button>
      </div>

      {/* ====== MODULES TAB ====== */}
      {tab === "modules" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-foreground">Módulos de Treinamento</h2>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Módulo
            </Button>
          </div>

          {showForm && (
            <div className="card-surface p-5 mb-6 space-y-3">
              <h3 className="font-semibold text-sm">{editingId ? "Editar Módulo" : "Novo Módulo"}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Título *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Comercial, RH..." />
                </div>
                <div>
                  <Label className="text-xs">Duração (horas)</Label>
                  <Input type="number" min="0.5" step="0.5" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Custo por hora (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost_per_hour} onChange={(e) => setForm({ ...form, cost_per_hour: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Ativo
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveModule}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {modules.map((mod) => (
              <div key={mod.id} className="card-surface p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{mod.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {mod.duration_hours}h • R$ {Number(mod.cost_per_hour).toFixed(2)}/h
                      {mod.category && ` • ${mod.category}`}
                      {!mod.is_active && " • Inativo"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => handleEditModule(mod)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteModule(mod.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {modules.length === 0 && (
              <p className="text-center text-muted-foreground py-10">Nenhum módulo cadastrado.</p>
            )}
          </div>
        </>
      )}

      {/* ====== REQUESTS TAB ====== */}
      {tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhuma solicitação recebida.</p>
          ) : (
            requests.map((req) => {
              const mod = modules.find((m) => m.id === req.module_id);
              const st = statusConfig[req.status] || statusConfig.pending;
              return (
                <div key={req.id} className="card-surface p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{mod?.title || "Módulo removido"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solicitado por <span className="font-medium text-foreground">{profiles[req.user_id] || req.user_id}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]", st.color)}>
                      {st.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{req.preferred_date || "Sem data"}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{req.participants} participante{req.participants > 1 ? "s" : ""}</span>
                    <span>{new Date(req.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {req.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mb-2">{req.notes}</p>}
                  {req.admin_note && <p className="text-xs text-muted-foreground bg-primary/5 rounded p-2 mb-2"><span className="font-semibold">Sua resposta:</span> {req.admin_note}</p>}

                  {req.status === "pending" && (
                    respondingId === req.id ? (
                      <div className="border-t border-border/50 pt-3 mt-3 space-y-2">
                        <div className="flex gap-2">
                          {["approved", "rejected", "completed"].map((s) => (
                            <Button
                              key={s}
                              size="sm"
                              variant={respondStatus === s ? "default" : "outline"}
                              onClick={() => setRespondStatus(s)}
                            >
                              {s === "approved" ? "Aprovar" : s === "rejected" ? "Recusar" : "Concluído"}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          placeholder="Nota para o solicitante (opcional)..."
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value.slice(0, 500))}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleRespond(req.id)}>Enviar</Button>
                          <Button size="sm" variant="outline" onClick={() => setRespondingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => { setRespondingId(req.id); setRespondStatus("approved"); setAdminNote(""); }}>
                        Responder
                      </Button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminTreinamentoPresencial;
