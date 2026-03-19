import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, UserCircle, Building2, Briefcase, Pencil, Upload, Shield, UserX, UserCheck } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  cpf: string | null;
  empresa: string | null;
  cargo: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminUsuarios = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [roleDialog, setRoleDialog] = useState<{ userId: string; nome: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState("user");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data as Profile[]);

    // Fetch roles
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
    if (rolesData) {
      const map: Record<string, string> = {};
      rolesData.forEach((r: any) => { map[r.user_id] = r.role; });
      setRoles(map);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;
    const { error } = await supabase.from("profiles").update({
      nome: editingProfile.nome,
      cpf: editingProfile.cpf,
      empresa: editingProfile.empresa,
      cargo: editingProfile.cargo,
    }).eq("id", editingProfile.id);
    if (error) toast.error(error.message);
    else { toast.success("Perfil atualizado!"); setEditingProfile(null); fetchProfiles(); }

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "update_profile",
      entity_type: "profile",
      entity_id: editingProfile.id,
      details: { nome: editingProfile.nome },
    });
  };

  const handleToggleActive = async (profile: Profile) => {
    const newStatus = !profile.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus ? "Usuário reativado!" : "Usuário desativado!"); fetchProfiles(); }

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: newStatus ? "activate_user" : "deactivate_user",
      entity_type: "profile",
      entity_id: profile.id,
    });
  };

  const handleAssignRole = async () => {
    if (!roleDialog) return;
    // Remove existing role
    await supabase.from("user_roles").delete().eq("user_id", roleDialog.userId);
    // Insert new
    const { error } = await supabase.from("user_roles").insert({
      user_id: roleDialog.userId,
      role: selectedRole as any,
    });
    if (error) toast.error(error.message);
    else { toast.success("Role atualizada!"); setRoleDialog(null); fetchProfiles(); }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

      if (!row.nome) continue;

      // We can only create profiles, not auth users via client
      // So this inserts into profiles with a placeholder user_id
      // In production, you'd use an edge function for full user creation
      const { error } = await supabase.from("profiles").insert({
        user_id: crypto.randomUUID(), // placeholder
        nome: row.nome,
        cpf: row.cpf || null,
        empresa: row.empresa || null,
        cargo: row.cargo || null,
      });
      if (!error) imported++;
    }
    toast.success(`${imported} perfil(s) importado(s)!`);
    fetchProfiles();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = profiles.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.empresa?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.cargo?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.cpf?.includes(search) ?? false)
  );

  return (
    <AdminLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Usuários</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-2 text-sm text-muted-foreground">{profiles.length} usuário(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
            <Upload className="h-3.5 w-3.5" /> Importar CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, empresa, cargo ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="mt-6 card-surface overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Cargo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{p.nome}</span>
                          <p className="text-xs text-muted-foreground tabular-nums">{p.cpf || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground">{p.empresa || "—"}</td>
                    <td className="px-5 py-4 text-sm text-foreground">{p.cargo || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        roles[p.user_id] === "admin" ? "bg-primary/10 text-primary" :
                        roles[p.user_id] === "moderator" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
                      }`}>
                        {roles[p.user_id] || "user"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.is_active !== false ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}>
                        {p.is_active !== false ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingProfile(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setRoleDialog({ userId: p.user_id, nome: p.nome }); setSelectedRole(roles[p.user_id] || "user"); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Alterar role">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleToggleActive(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title={p.is_active !== false ? "Desativar" : "Reativar"}>
                          {p.is_active !== false ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          {editingProfile && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={editingProfile.nome} onChange={e => setEditingProfile({ ...editingProfile, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={editingProfile.cpf || ""} onChange={e => setEditingProfile({ ...editingProfile, cpf: e.target.value })} /></div>
              <div className="space-y-2"><Label>Empresa</Label><Input value={editingProfile.empresa || ""} onChange={e => setEditingProfile({ ...editingProfile, empresa: e.target.value })} /></div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={editingProfile.cargo || ""} onChange={e => setEditingProfile({ ...editingProfile, cargo: e.target.value })} /></div>
              <Button onClick={handleUpdateProfile} className="w-full bg-primary text-primary-foreground">Salvar Alterações</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Role — {roleDialog?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="moderator">Moderador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAssignRole} className="w-full bg-primary text-primary-foreground">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsuarios;
