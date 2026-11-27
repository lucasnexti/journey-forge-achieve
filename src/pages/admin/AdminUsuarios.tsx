import { useState, useEffect, useRef, useCallback } from "react";
import { isCorporateEmail, CORPORATE_EMAIL_MESSAGE } from "@/lib/corporateEmail";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import PaginationControls from "@/components/admin/PaginationControls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, UserCircle, Pencil, Upload, Shield, UserX, UserCheck, Users, Eye, Plus } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { z } from "zod";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  empresa: string | null;
  cargo: string | null;
  is_active: boolean;
  created_at: string;
  last_active_at?: string | null;
}

const roleLabel: Record<string, string> = { admin: "Administrador", moderator: "Moderador", user: "Aluno" };

const inviteSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255).refine(isCorporateEmail, CORPORATE_EMAIL_MESSAGE),
  empresa: z.string().trim().max(100),
  cargo: z.string().trim().max(100),
  role: z.enum(["user", "moderator", "admin"]),
});
const emptyInvite = { nome: "", email: "", empresa: "", cargo: "", role: "user" as "user" | "moderator" | "admin", company_id: "", env_role: "member" as "admin" | "member", new_company: "" };
const NEW_COMPANY = "__new__";
const slugify = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Company = { id: string; name: string };
type Membership = { company_id: string; role: "admin" | "member" };

const profileSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100, "Nome muito longo"),
  cpf: z.string().trim().max(14).nullable(),
  empresa: z.string().trim().max(100).nullable(),
  cargo: z.string().trim().max(100).nullable(),
});

const PAGE_SIZE_DEFAULT = 25;

const AdminUsuarios = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [roleDialog, setRoleDialog] = useState<{ userId: string; nome: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState("user");
  const [toggleConfirm, setToggleConfirm] = useState<Profile | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<Profile | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const [inviting, setInviting] = useState(false);
  const { isMaster } = useIsAdmin();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [memberships, setMemberships] = useState<Record<string, Membership>>({});
  const [editCompany, setEditCompany] = useState<Membership>({ company_id: "", role: "member" });
  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name;

  const fetchCompanies = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("learning_companies").select("id,name").eq("is_active", true).order("name"),
      supabase.from("learning_company_memberships").select("user_id,company_id,role").is("revoked_at", null),
    ]);
    setCompanies((c as Company[]) ?? []);
    const map: Record<string, Membership> = {};
    for (const row of (m as any[]) ?? []) map[row.user_id] = { company_id: row.company_id, role: row.role };
    setMemberships(map);
  };
  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => {
    if (editingProfile) setEditCompany(memberships[editingProfile.user_id] ?? { company_id: "", role: "member" });
  }, [editingProfile?.id]);

  const handleInvite = async () => {
    const r = inviteSchema.safeParse(invite);
    if (!r.success) { toast.error(r.error.errors[0].message); return; }
    if (isMaster && !invite.company_id) { toast.error("Selecione a empresa do usuário."); return; }
    const newName = invite.new_company.trim();
    if (isMaster && invite.company_id === NEW_COMPANY && newName.length < 2) { toast.error("Informe o nome da nova empresa."); return; }
    setInviting(true);
    let companyId = invite.company_id, companyLabel = companyName(invite.company_id);
    if (isMaster && companyId === NEW_COMPANY) {
      const existing = companies.find((c) => c.name.toLowerCase() === newName.toLowerCase());
      if (existing) { companyId = existing.id; companyLabel = existing.name; }
      else {
        const { data: created, error: cErr } = await supabase.from("learning_companies").insert({ name: newName, slug: slugify(newName) }).select("id,name").single();
        if (cErr || !created) { setInviting(false); toast.error(`Não foi possível criar a empresa: ${cErr?.message ?? ""}`); return; }
        companyId = created.id; companyLabel = created.name;
      }
      fetchCompanies();
      setInvite((v) => ({ ...v, company_id: companyId, new_company: "" }));
    }
    const companyBody = isMaster ? { company_id: companyId, env_role: invite.env_role, empresa: companyLabel ?? r.data.empresa } : {};
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { ...r.data, ...companyBody, redirectTo: "https://journey-forge-achieve.lovable.app" },
    });
    setInviting(false);
    const msg = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) || error.message : null);
    if (msg) { toast.error(msg); return; }
    toast.success((data as any)?.moved ? `${r.data.email} já tinha cadastro e agora está vinculado à nova empresa (o vínculo anterior foi encerrado).` : `Convite enviado para ${r.data.email}`);
    setInviteOpen(false);
    fetchProfiles(); fetchRoles(); fetchStats();
  };


  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, admins: 0 });

  useEffect(() => {
    fetchProfiles();
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRoles();
    fetchStats();
  }, []);

  // Reset page when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const fetchStats = async () => {
    const [{ count: total }, { count: active }, { count: adminCount }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    setStats({
      total: total || 0,
      active: active || 0,
      inactive: (total || 0) - (active || 0),
      admins: adminCount || 0,
    });
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (debouncedSearch) {
      const s = debouncedSearch.replace(/[%,()*]/g, " ").trim();
      if (s) query = query.or(`nome.ilike.%${s}%,email.ilike.%${s}%`);
    }

    if (statusFilter === "active") query = query.eq("is_active", true);
    if (statusFilter === "inactive") query = query.eq("is_active", false);

    const { data, count } = await query;
    setProfiles((data as Profile[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.user_id] = r.role; });
      setRoles(map);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;

    const result = profileSchema.safeParse({
      nome: editingProfile.nome,
      cpf: editingProfile.cpf || null,
      empresa: editingProfile.empresa || null,
      cargo: editingProfile.cargo || null,
    });

    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    const { error } = await supabase.from("profiles").update({
      nome: result.data.nome,
      cpf: result.data.cpf,
      empresa: result.data.empresa,
      cargo: result.data.cargo,
    }).eq("id", editingProfile.id);

    if (error) { toast.error(error.message); return; }
    const current = memberships[editingProfile.user_id];
    if (isMaster && editCompany.company_id && (current?.company_id !== editCompany.company_id || current?.role !== editCompany.role)) {
      const { error: mErr } = await supabase.rpc("master_move_user" as never, { _user: editingProfile.user_id, _company: editCompany.company_id, _role: editCompany.role } as never);
      if (mErr) { toast.error(`Perfil salvo, mas a empresa não foi vinculada: ${mErr.message}`); return; }
      await supabase.from("profiles").update({ empresa: companyName(editCompany.company_id) ?? null }).eq("id", editingProfile.id);
      fetchCompanies();
    }
    toast.success("Perfil atualizado!");
    setEditingProfile(null);
    fetchProfiles();
    fetchStats();

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "update_profile",
      entity_type: "profile",
      entity_id: editingProfile.id,
      details: { nome: result.data.nome },
    });
  };

  const handleToggleActive = async () => {
    if (!toggleConfirm) return;
    const newStatus = !toggleConfirm.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", toggleConfirm.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus ? "Usuário reativado!" : "Usuário desativado!");
    setToggleConfirm(null);
    fetchProfiles();
    fetchStats();

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: newStatus ? "activate_user" : "deactivate_user",
      entity_type: "profile",
      entity_id: toggleConfirm.id,
    });
  };

  const handleAssignRole = async () => {
    if (!roleDialog) return;
    await supabase.from("user_roles").delete().eq("user_id", roleDialog.userId).in("role", ["admin", "moderator", "user"]);
    const { error } = await supabase.from("user_roles").insert({
      user_id: roleDialog.userId,
      role: selectedRole as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Role atualizada!");
    setRoleDialog(null);
    fetchRoles();
    fetchStats();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

    let imported = 0;
    let errors = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

      const result = profileSchema.safeParse({
        nome: row.nome,
        cpf: row.cpf || null,
        empresa: row.empresa || null,
        cargo: row.cargo || null,
      });

      if (!result.success) { errors++; continue; }

      const { error } = await supabase.from("profiles").insert({
        user_id: crypto.randomUUID(),
        nome: result.data.nome,
        cpf: result.data.cpf,
        empresa: result.data.empresa,
        cargo: result.data.cargo,
      });
      if (!error) imported++;
      else errors++;
    }
    toast.success(`${imported} perfil(s) importado(s)${errors > 0 ? `, ${errors} com erro` : ""}`);
    fetchProfiles();
    fetchStats();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statCards = [
    { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Ativos", value: stats.active, color: "text-green-600" },
    { label: "Inativos", value: stats.inactive, color: "text-destructive" },
    { label: "Admins", value: stats.admins, icon: Shield, color: "text-primary" },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Usuários</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
            <Upload className="h-3.5 w-3.5" /> Importar CSV
          </Button>
          <Button size="sm" onClick={() => { setInvite(emptyInvite); setInviteOpen(true); }} className="gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Cadastrar usuário
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-surface p-4"
          >
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{stat.value.toLocaleString("pt-BR")}</p>
            <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="mt-4 card-surface overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
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
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-foreground">{p.nome}</span>
                        <p className="text-xs text-muted-foreground">{p.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground">{companyName(memberships[p.user_id]?.company_id) || <span className="text-muted-foreground">Sem empresa vinculada</span>}</td>
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
                    <Badge variant={p.is_active !== false ? "default" : "destructive"} className="text-[10px]">
                      {p.is_active !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewing(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Visualizar">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingProfile(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setRoleDialog({ userId: p.user_id, nome: p.nome }); setSelectedRole(roles[p.user_id] || "user"); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Alterar role">
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setToggleConfirm(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title={p.is_active !== false ? "Desativar" : "Reativar"}>
                        {p.is_active !== false ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar usuário</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">A pessoa receberá um convite por e-mail para criar a própria senha.</p>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={invite.nome} maxLength={100} onChange={e => setInvite({ ...invite, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={invite.email} maxLength={255} onChange={e => setInvite({ ...invite, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              {isMaster ? (
                <div className="space-y-2"><Label>Empresa *</Label>
                  <Select value={invite.company_id} onValueChange={(v) => setInvite({ ...invite, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_COMPANY}>+ Cadastrar nova empresa</SelectItem>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {invite.company_id === NEW_COMPANY && (
                    <Input autoFocus placeholder="Nome da nova empresa" maxLength={100} value={invite.new_company} onChange={(e) => setInvite({ ...invite, new_company: e.target.value })} />
                  )}
                </div>
              ) : (
                <div className="space-y-2"><Label>Empresa</Label><Input value={invite.empresa} maxLength={100} onChange={e => setInvite({ ...invite, empresa: e.target.value })} /></div>
              )}
              <div className="space-y-2"><Label>Cargo</Label><Input value={invite.cargo} maxLength={100} onChange={e => setInvite({ ...invite, cargo: e.target.value })} /></div>
            </div>
            {isMaster && (
              <div className="space-y-2"><Label>Perfil na empresa *</Label>
                <Select value={invite.env_role} onValueChange={(v) => setInvite({ ...invite, env_role: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="member">Usuário comum</SelectItem><SelectItem value="admin">Administrador da empresa</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Perfil de acesso *</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Aluno</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-gradient-nexti text-primary-foreground hover:opacity-90">
              {inviting ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do usuário</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              {[
                ["Nome", viewing.nome],
                ["E-mail", viewing.email],
                ["Empresa", companyName(memberships[viewing.user_id]?.company_id) ?? "Sem empresa vinculada"],
                ["Cargo", viewing.cargo],
                ["CPF", viewing.cpf],
                ["Perfil", roleLabel[roles[viewing.user_id] || "user"]],
                ["Status", viewing.is_active !== false ? "Ativo" : "Inativo"],
                ["Cadastro", new Date(viewing.created_at).toLocaleDateString("pt-BR")],
                ["Último acesso", viewing.last_active_at ? new Date(viewing.last_active_at).toLocaleString("pt-BR") : null],
              ].map(([k, v]) => (
                <div key={k as string} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 text-foreground break-all">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
            <Button onClick={() => { setEditingProfile(viewing); setViewing(null); }}>Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          {editingProfile && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={editingProfile.nome} onChange={e => setEditingProfile({ ...editingProfile, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={editingProfile.cpf || ""} onChange={e => setEditingProfile({ ...editingProfile, cpf: e.target.value })} maxLength={14} /></div>
              {isMaster ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Empresa</Label>
                    <Select value={editCompany.company_id} onValueChange={(v) => setEditCompany({ ...editCompany, company_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Perfil na empresa</Label>
                    <Select value={editCompany.role} onValueChange={(v) => setEditCompany({ ...editCompany, role: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="member">Usuário comum</SelectItem><SelectItem value="admin">Administrador da empresa</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2"><Label>Empresa</Label><Input value={companyName(memberships[editingProfile.user_id]?.company_id) ?? "Sem empresa vinculada"} disabled /></div>
              )}
              <div className="space-y-2"><Label>Cargo</Label><Input value={editingProfile.cargo || ""} onChange={e => setEditingProfile({ ...editingProfile, cargo: e.target.value })} maxLength={100} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancelar</Button>
            <Button onClick={handleUpdateProfile} className="bg-gradient-nexti text-primary-foreground hover:opacity-90">Salvar</Button>
          </DialogFooter>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>Cancelar</Button>
            <Button onClick={handleAssignRole} className="bg-gradient-nexti text-primary-foreground hover:opacity-90">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Confirmation */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={() => setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.is_active !== false ? "Desativar usuário?" : "Reativar usuário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.is_active !== false
                ? `O usuário "${toggleConfirm?.nome}" não poderá acessar a plataforma enquanto estiver desativado.`
                : `O usuário "${toggleConfirm?.nome}" poderá acessar a plataforma novamente.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {toggleConfirm?.is_active !== false ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsuarios;
