import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import PaginationControls from "@/components/admin/PaginationControls";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Shield, Activity } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { motion } from "framer-motion";

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

const PAGE_SIZE_DEFAULT = 50;

const AdminLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => { fetchLogs(); }, [page, pageSize, debouncedSearch, entityFilter]);
  useEffect(() => { setPage(1); }, [debouncedSearch, entityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (debouncedSearch) {
      query = query.or(`action.ilike.%${debouncedSearch}%,entity_type.ilike.%${debouncedSearch}%`);
    }
    if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);

    const { data, count } = await query;
    setLogs(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const entityTypes = ["profile", "track", "lesson", "enrollment", "notification", "certificate", "quiz"];

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("deactivate") || action.includes("cancel")) return "bg-destructive/10 text-destructive";
    if (action.includes("create") || action.includes("activate") || action.includes("issue")) return "bg-green-500/10 text-green-600";
    return "bg-primary/10 text-primary";
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Logs de Auditoria</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-2 text-sm text-muted-foreground">Registro de todas as ações administrativas na plataforma.</p>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-surface px-4 py-2 hidden sm:flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground tabular-nums">{totalCount.toLocaleString("pt-BR")}</span>
          <span className="text-xs text-muted-foreground">registros</span>
        </motion.div>
      </div>

      {/* Search & Filters */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum log encontrado.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{ACTION_LABELS[log.action] || log.action}</p>
                    <Badge variant="outline" className={`text-[10px] ${getActionColor(log.action)}`}>
                      {log.entity_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {log.entity_id ? `ID: ${log.entity_id.substring(0, 8)}…` : ""}
                    {log.details && Object.keys(log.details).length > 0 && ` · ${JSON.stringify(log.details).substring(0, 80)}`}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleDateString("pt-BR")} {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}

        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;
