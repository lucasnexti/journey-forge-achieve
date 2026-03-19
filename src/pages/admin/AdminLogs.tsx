import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  update_profile: "Editou perfil",
  activate_user: "Reativou usuário",
  deactivate_user: "Desativou usuário",
  create_track: "Criou trilha",
  update_track: "Editou trilha",
  delete_track: "Excluiu trilha",
  create_lesson: "Adicionou aula",
  delete_lesson: "Excluiu aula",
  create_enrollment: "Matriculou usuário",
  cancel_enrollment: "Cancelou matrícula",
  send_notification: "Enviou notificação",
  create_quiz: "Criou quiz",
  issue_certificate: "Emitiu certificado",
};

const AdminLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  const filtered = logs.filter(l =>
    (ACTION_LABELS[l.action] || l.action).toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <h1 className="font-display text-xl font-bold text-primary">Logs de Auditoria</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
      <p className="mt-2 text-sm text-muted-foreground">Registro de todas as ações administrativas na plataforma.</p>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="mt-6 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum log registrado.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ACTION_LABELS[log.action] || log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.entity_type} {log.entity_id ? `· ${log.entity_id.substring(0, 8)}...` : ""}
                    {log.details && Object.keys(log.details).length > 0 && ` · ${JSON.stringify(log.details).substring(0, 60)}`}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleDateString("pt-BR")} {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;
