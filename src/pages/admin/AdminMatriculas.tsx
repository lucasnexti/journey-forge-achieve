import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import PaginationControls from "@/components/admin/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, UserPlus, X, GraduationCap, Users, TrendingUp } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { motion } from "framer-motion";

interface Enrollment {
  id: string;
  user_id: string;
  track_id: string;
  status: string | null;
  enrolled_at: string | null;
  profiles?: { nome: string; empresa: string | null } | null;
  tracks?: { title: string } | null;
}

const PAGE_SIZE_DEFAULT = 25;

const AdminMatriculas = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; user_id: string; nome: string; empresa: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });

  useEffect(() => { fetchDropdowns(); fetchStats(); }, []);
  useEffect(() => { fetchEnrollments(); }, [page, pageSize, debouncedSearch, statusFilter]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const fetchStats = async () => {
    const [{ count: total }, { count: active }, { count: completed }] = await Promise.all([
      supabase.from("enrollments").select("*", { count: "exact", head: true }),
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
    ]);
    setStats({ total: total || 0, active: active || 0, completed: completed || 0 });
  };

  const fetchDropdowns = async () => {
    const [tracksRes, profilesRes] = await Promise.all([
      supabase.from("tracks").select("id, title").eq("is_active", true).order("order_index"),
      supabase.from("profiles").select("id, user_id, nome, empresa"),
    ]);
    if (tracksRes.data) setTracks(tracksRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
  };

  const fetchEnrollments = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("enrollments")
      .select("*, profiles:user_id(nome, empresa), tracks:track_id(title)", { count: "exact" })
      .order("enrolled_at", { ascending: false })
      .range(from, to);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, count } = await query;

    // Client-side search filter on joined fields (Supabase doesn't support ilike on joined tables easily)
    let filtered = (data as unknown as Enrollment[]) || [];
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      filtered = filtered.filter(e =>
        (e.profiles as any)?.nome?.toLowerCase().includes(s) ||
        (e.tracks as any)?.title?.toLowerCase().includes(s)
      );
    }

    setEnrollments(filtered);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const handleEnroll = async () => {
    if (!selectedUser || !selectedTrack) {
      toast.error("Selecione um usuário e uma trilha.");
      return;
    }
    const { error } = await supabase.from("enrollments").insert({
      user_id: selectedUser,
      track_id: selectedTrack,
    });
    if (error) {
      if (error.code === "23505") toast.error("Este usuário já está matriculado nesta trilha.");
      else toast.error(error.message);
    } else {
      toast.success("Matrícula realizada com sucesso!");
      setShowForm(false);
      setSelectedUser("");
      setSelectedTrack("");
      fetchEnrollments();
      fetchStats();
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm) return;
    const { error } = await supabase.from("enrollments").update({ status: "cancelled" }).eq("id", cancelConfirm);
    if (error) toast.error(error.message);
    else {
      toast.success("Matrícula cancelada.");
      setCancelConfirm(null);
      fetchEnrollments();
      fetchStats();
    }
  };

  const statusLabel = (s: string | null) => {
    if (s === "active") return { text: "Ativa", cls: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" };
    if (s === "completed") return { text: "Concluída", cls: "bg-primary/10 text-primary" };
    return { text: "Cancelada", cls: "bg-destructive/10 text-destructive" };
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Matrículas EAD</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Nova Matrícula"}
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Ativas", value: stats.active, icon: GraduationCap, color: "text-green-600" },
          { label: "Concluídas", value: stats.completed, icon: TrendingUp, color: "text-primary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-surface p-4">
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{stat.value.toLocaleString("pt-BR")}</p>
            <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* New enrollment form */}
      {showForm && (
        <div className="mt-5 card-surface p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Matricular Usuário</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
                <option value="">Selecionar usuário...</option>
                {profiles.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome} {p.empresa ? `(${p.empresa})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Trilha</Label>
              <select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
                <option value="">Selecionar trilha...</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleEnroll} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Matricular
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="mt-4 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Aluno</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Trilha</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma matrícula encontrada.</td></tr>
              ) : (
                enrollments.map((e) => {
                  const st = statusLabel(e.status);
                  return (
                    <tr key={e.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-foreground">{(e.profiles as any)?.nome || "—"}</td>
                      <td className="px-5 py-4 text-sm text-foreground">{(e.tracks as any)?.title || "—"}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-sm tabular-nums text-muted-foreground">
                        {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {e.status === "active" && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/70 h-7 text-xs" onClick={() => setCancelConfirm(e.id)}>
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={() => setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar matrícula?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação cancelará a matrícula do aluno nesta trilha. O progresso não será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Matrícula
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminMatriculas;
