import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, BookOpen } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface EnvironmentRow { id: string; name: string; is_active: boolean; users: number; admins: number; active_users: number; own_courses: number; shared_courses: number; enrollments: number; completions: number; certificates: number; exams_passed: number; coins: number }

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function fetchEnvironmentsReport(start: string | null, end: string | null) {
  const { data, error } = await rpc("master_environments_report", { _start: start, _end: end });
  if (error) throw new Error(error.message);
  return (data ?? []) as EnvironmentRow[];
}

export default function AdminAmbientes() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
  const [sharing, setSharing] = useState<EnvironmentRow | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const report = useQuery({ queryKey: ["environments-report", "all"], queryFn: () => fetchEnvironmentsReport(null, null) });
  const tracks = useQuery({
    queryKey: ["tracks-with-owner"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tracks").select("id,title,company_id").order("title");
      if (error) throw error;
      return data as { id: string; title: string; company_id: string }[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["environments-report"] }); qc.invalidateQueries({ queryKey: ["environments"] }); };

  const save = useMutation({
    mutationFn: async () => {
      const name = editing!.name.trim();
      if (name.length < 2) throw new Error("Informe o nome do ambiente");
      const { error } = editing!.id
        ? await supabase.from("learning_companies").update({ name }).eq("id", editing!.id)
        : await supabase.from("learning_companies").insert({ name, slug: slugify(name) });
      if (error) throw new Error(error.code === "23505" ? "Já existe um ambiente com esse nome" : error.message);
    },
    onSuccess: () => { toast.success("Ambiente salvo"); setEditing(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("learning_companies").update({ is_active: v.is_active }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const openSharing = async (env: EnvironmentRow) => {
    const { data, error } = await supabase.from("track_company_access").select("track_id").eq("company_id", env.id);
    if (error) { toast.error(error.message); return; }
    setPicked(new Set((data ?? []).map((r) => r.track_id)));
    setSharing(env);
  };

  const share = useMutation({
    mutationFn: async () => {
      const { error } = await rpc("master_set_track_access", { _company: sharing!.id, _tracks: Array.from(picked) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Cursos liberados atualizados"); setSharing(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const names = useMemo(() => Object.fromEntries((report.data ?? []).map((e) => [e.id, e.name])), [report.data]);
  const shareable = (tracks.data ?? []).filter((t) => t.company_id !== sharing?.id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-primary">Ambientes</h1>
            <p className="text-sm text-muted-foreground">Cada cliente tem o seu ambiente, com seus cursos e colaboradores. Só o Master vê esta tela.</p>
          </div>
          <Button onClick={() => setEditing({ name: "" })}><Plus className="mr-2 h-4 w-4" />Novo ambiente</Button>
        </div>
        <div className="rounded-xl border border-border/60 bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Ambiente</TableHead><TableHead>Usuários</TableHead><TableHead>Admins</TableHead><TableHead>Cursos próprios</TableHead><TableHead>Cursos liberados</TableHead><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {report.isLoading && <TableRow><TableCell colSpan={7} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
              {report.error && <TableRow><TableCell colSpan={7} className="text-destructive">{(report.error as Error).message}</TableCell></TableRow>}
              {report.data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.users}</TableCell><TableCell>{e.admins}</TableCell>
                  <TableCell>{e.own_courses}</TableCell><TableCell>{e.shared_courses}</TableCell>
                  <TableCell><Switch aria-label={`Ativo: ${e.name}`} checked={e.is_active} onCheckedChange={(v) => toggle.mutate({ id: e.id, is_active: v })} /></TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => openSharing(e)}><BookOpen className="mr-1 h-4 w-4" />Liberar cursos</Button>
                    <Button variant="ghost" size="sm" aria-label={`Renomear ${e.name}`} onClick={() => setEditing({ id: e.id, name: e.name })}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Renomear ambiente" : "Novo ambiente"}</DialogTitle></DialogHeader>
          <div className="space-y-1"><Label htmlFor="env-name">Nome do cliente</Label><Input id="env-name" value={editing?.name ?? ""} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} /></div>
          <DialogFooter><Button disabled={save.isPending} onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sharing} onOpenChange={(o) => !o && setSharing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cursos liberados para {sharing?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O curso continua sendo um só: os alunos de {sharing?.name} passam a vê-lo, mas só o ambiente dono pode editá-lo.</p>
          <div className="space-y-2">
            {shareable.length === 0 && <p className="text-sm text-muted-foreground">Nenhum curso de outro ambiente para liberar.</p>}
            {shareable.map((t) => (
              <label key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2 text-sm">
                <Checkbox checked={picked.has(t.id)} onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(t.id); else n.delete(t.id); return n; })} />
                <span className="flex-1">{t.title}</span>
                <span className="text-xs text-muted-foreground">{names[t.company_id]}</span>
              </label>
            ))}
          </div>
          <DialogFooter><Button disabled={share.isPending} onClick={() => share.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
