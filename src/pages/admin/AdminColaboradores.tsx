import { useState } from "react";
import { isCorporateEmail, CORPORATE_EMAIL_MESSAGE } from "@/lib/corporateEmail";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { UserPlus, ArrowRightLeft } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useSelectedEnvironment } from "@/hooks/useSelectedEnvironment";
import { useEnvironments } from "@/hooks/useEnvironments";

interface Member { user_id: string; nome: string | null; email: string | null; cargo: string | null; role: "admin" | "member"; active: boolean; is_master: boolean }

const inviteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255).refine(isCorporateEmail, CORPORATE_EMAIL_MESSAGE),
  cargo: z.string().trim().max(100).optional(),
  env_role: z.enum(["admin", "member"]),
});

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export default function AdminColaboradores() {
  const qc = useQueryClient();
  const { isMaster, environment } = useIsAdmin();
  const [selectedEnv] = useSelectedEnvironment();
  const { data: envs = [] } = useEnvironments(isMaster);
  const companyId = isMaster && selectedEnv !== "all" ? selectedEnv : environment?.company_id ?? null;
  const companyName = isMaster ? envs.find((e) => e.id === companyId)?.name : environment?.company_name;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ nome: "", email: "", cargo: "", env_role: "member" as "admin" | "member" });
  const [moving, setMoving] = useState<Member | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const members = useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await rpc("company_members", { _company: companyId });
      if (error) throw new Error(error.message);
      return (data ?? []) as Member[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["company-members"] });

  const setAccess = useMutation({
    mutationFn: async (v: { user: string; role: string; active: boolean }) => {
      const { error } = await rpc("set_member_access", { _user: v.user, _company: companyId, _role: v.role, _active: v.active });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Acesso atualizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const r = inviteSchema.safeParse(invite);
      if (!r.success) throw new Error(r.error.errors[0].message);
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { nome: r.data.nome, email: r.data.email, cargo: r.data.cargo || null, empresa: companyName ?? null, env_role: r.data.env_role, company_id: companyId, redirectTo: window.location.origin },
      });
      const msg = (data as { error?: string } | null)?.error
        || (error ? await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j?.error).catch(() => null) || error.message : null);
      if (msg) throw new Error(msg);
      return r.data.email;
    },
    onSuccess: (email) => { toast.success(`Convite enviado para ${email}`); setInviteOpen(false); setInvite({ nome: "", email: "", cargo: "", env_role: "member" }); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await rpc("master_move_user", { _user: moving!.user_id, _company: moveTo, _role: moving!.role });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Usuário movido de ambiente"); setMoving(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-primary">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              {companyId ? <>Pessoas do ambiente <strong className="text-foreground">{companyName}</strong>. Admin inclui cursos e colaboradores; Comum só assiste aos cursos.</> : "Escolha um ambiente no topo da página."}
            </p>
          </div>
          <Button disabled={!companyId} onClick={() => setInviteOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Convidar colaborador</Button>
        </div>

        {companyId && (
          <div className="rounded-xl border border-border/60 bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Ativo</TableHead>{isMaster && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {members.isLoading && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
                {members.error && <TableRow><TableCell colSpan={5} className="text-destructive">{(members.error as Error).message}</TableCell></TableRow>}
                {members.data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhum colaborador neste ambiente ainda.</TableCell></TableRow>}
                {members.data?.map((m) => (
                  <TableRow key={m.user_id} className={m.active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{m.nome || "—"} {m.is_master && <Badge className="ml-1">Master</Badge>}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <Select value={m.role} disabled={setAccess.isPending} onValueChange={(role) => setAccess.mutate({ user: m.user_id, role, active: m.active })}>
                        <SelectTrigger aria-label={`Perfil de ${m.nome}`} className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="member">Comum</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Switch aria-label={`Ativo: ${m.nome}`} checked={m.active} disabled={setAccess.isPending} onCheckedChange={(active) => setAccess.mutate({ user: m.user_id, role: m.role, active })} /></TableCell>
                    {isMaster && <TableCell><Button variant="ghost" size="sm" onClick={() => { setMoving(m); setMoveTo(""); }}><ArrowRightLeft className="mr-1 h-4 w-4" />Mover</Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar colaborador para {companyName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="inv-nome">Nome</Label><Input id="inv-nome" value={invite.nome} onChange={(e) => setInvite({ ...invite, nome: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="inv-email">E-mail</Label><Input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="inv-cargo">Cargo (opcional)</Label><Input id="inv-cargo" value={invite.cargo} onChange={(e) => setInvite({ ...invite, cargo: e.target.value })} /></div>
            <div className="space-y-1"><Label>Perfil</Label>
              <Select value={invite.env_role} onValueChange={(v) => setInvite({ ...invite, env_role: v as "admin" | "member" })}>
                <SelectTrigger aria-label="Perfil do convidado"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="member">Comum — assiste aos cursos</SelectItem><SelectItem value="admin">Admin — inclui cursos e colaboradores</SelectItem></SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">A pessoa recebe um e-mail para criar a senha.</p>
          </div>
          <DialogFooter><Button disabled={sendInvite.isPending} onClick={() => sendInvite.mutate()}>{sendInvite.isPending ? "Enviando…" : "Enviar convite"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moving} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover {moving?.nome} para outro ambiente</DialogTitle></DialogHeader>
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger aria-label="Novo ambiente"><SelectValue placeholder="Escolha o ambiente" /></SelectTrigger>
            <SelectContent>{envs.filter((e) => e.id !== companyId).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter><Button disabled={!moveTo || move.isPending} onClick={() => move.mutate()}>Mover</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
