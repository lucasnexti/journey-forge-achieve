import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Search, UserPlus, X } from "lucide-react";

interface Track {
  id: string;
  title: string;
}

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  empresa: string | null;
}

interface Enrollment {
  id: string;
  user_id: string;
  track_id: string;
  status: string | null;
  enrolled_at: string | null;
  profiles?: { nome: string; empresa: string | null } | null;
  tracks?: { title: string } | null;
}

const AdminMatriculas = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [enrollRes, tracksRes, profilesRes] = await Promise.all([
      supabase.from("enrollments").select("*, profiles(nome, empresa), tracks(title)").order("enrolled_at", { ascending: false }),
      supabase.from("tracks").select("id, title").eq("is_active", true).order("order_index"),
      supabase.from("profiles").select("id, user_id, nome, empresa"),
    ]);

    if (enrollRes.data) setEnrollments(enrollRes.data as unknown as Enrollment[]);
    if (tracksRes.data) setTracks(tracksRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
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
      fetchData();
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from("enrollments").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Matrícula cancelada.");
      fetchData();
    }
  };

  const filtered = enrollments.filter((e) => {
    const name = (e.profiles as any)?.nome || "";
    const track = (e.tracks as any)?.title || "";
    return name.toLowerCase().includes(search.toLowerCase()) || track.toLowerCase().includes(search.toLowerCase());
  });

  const statusLabel = (s: string | null) => {
    if (s === "active") return { text: "Ativa", cls: "bg-success/10 text-success" };
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

      {/* New enrollment form */}
      {showForm && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Matricular Usuário</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Usuário</Label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Selecionar usuário...</option>
                {profiles.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome} {p.empresa ? `(${p.empresa})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Trilha</Label>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
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

      {/* Search */}
      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma matrícula encontrada.</td></tr>
              ) : (
                filtered.map((e) => {
                  const st = statusLabel(e.status);
                  return (
                    <tr key={e.id} className="border-b border-border/30 last:border-0">
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
                          <button onClick={() => handleCancel(e.id)} className="text-destructive hover:text-destructive/70 transition-colors" title="Cancelar matrícula">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMatriculas;
