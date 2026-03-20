import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import PaginationControls from "@/components/admin/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Plus, X, Users, Mail, CheckCircle, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { z } from "zod";
import { motion } from "framer-motion";

const notifSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(100, "Título muito longo"),
  message: z.string().trim().min(1, "Mensagem obrigatória").max(500, "Mensagem muito longa"),
});

const PAGE_SIZE_DEFAULT = 50;

const AdminNotificacoes = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: "", message: "", type: "info", target: "all" as string });
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [typeFilter, setTypeFilter] = useState("all");

  // Stats
  const [stats, setStats] = useState({ total: 0, unread: 0 });

  useEffect(() => { fetchProfiles(); fetchStats(); }, []);
  useEffect(() => { fetchNotifications(); }, [page, pageSize, debouncedSearch, typeFilter]);
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter]);

  const fetchStats = async () => {
    const [{ count: total }, { count: unread }] = await Promise.all([
      supabase.from("notifications").select("*", { count: "exact", head: true }),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
    ]);
    setStats({ total: total || 0, unread: unread || 0 });
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, nome");
    if (data) setProfiles(data);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (debouncedSearch) {
      query = query.or(`title.ilike.%${debouncedSearch}%,message.ilike.%${debouncedSearch}%`);
    }
    if (typeFilter !== "all") query = query.eq("type", typeFilter);

    const { data, count } = await query;
    setNotifications(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const getUserName = (uid: string) => profiles.find(p => p.user_id === uid)?.nome || uid.substring(0, 8);

  const handleSend = async () => {
    const result = notifSchema.safeParse({ title: newNotif.title, message: newNotif.message });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setSending(true);
    const targetUsers = newNotif.target === "all"
      ? profiles.map(p => p.user_id)
      : [newNotif.target];

    // Batch insert in chunks of 100 for stability
    const inserts = targetUsers.map(uid => ({
      user_id: uid,
      title: result.data.title,
      message: result.data.message,
      type: newNotif.type,
    }));

    const CHUNK_SIZE = 100;
    let success = 0;
    for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
      const chunk = inserts.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("notifications").insert(chunk);
      if (!error) success += chunk.length;
    }

    toast.success(`Notificação enviada para ${success} usuário(s)!`);
    setSending(false);
    setShowNew(false);
    setNewNotif({ title: "", message: "", type: "info", target: "all" });
    fetchNotifications();
    fetchStats();

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "send_notification",
      entity_type: "notification",
      details: { title: result.data.title, recipients: success },
    });
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Notificações</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <Button onClick={() => setShowNew(!showNew)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? "Cancelar" : "Nova Notificação"}
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Enviadas", value: stats.total, color: "text-primary" },
          { label: "Não lidas", value: stats.unread, color: "text-warning" },
          { label: "Usuários", value: profiles.length, color: "text-muted-foreground" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-surface p-4">
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{stat.value.toLocaleString("pt-BR")}</p>
            <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {showNew && (
        <div className="mt-5 card-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Título *</Label><Input value={newNotif.title} onChange={e => setNewNotif({ ...newNotif, title: e.target.value })} maxLength={100} /></div>
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={newNotif.target} onValueChange={v => setNewNotif({ ...newNotif, target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários ({profiles.length})</SelectItem>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Mensagem *</Label><Textarea value={newNotif.message} onChange={e => setNewNotif({ ...newNotif, message: e.target.value })} rows={3} maxLength={500} /></div>
          <div className="flex items-center gap-3">
            <div className="space-y-2 max-w-xs">
              <Label>Tipo</Label>
              <Select value={newNotif.type} onValueChange={v => setNewNotif({ ...newNotif, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informativo</SelectItem>
                  <SelectItem value="warning">Alerta</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSend} disabled={sending} className="bg-primary text-primary-foreground">
            <Send className="h-4 w-4 mr-1" /> {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar notificações..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Alerta</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação encontrada.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map(n => (
              <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                  n.type === "warning" ? "bg-warning/10" : n.type === "success" ? "bg-green-500/10" : "bg-primary/10"
                }`}>
                  <Bell className={`h-4 w-4 ${n.type === "warning" ? "text-warning" : n.type === "success" ? "text-green-600" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{getUserName(n.user_id)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Badge variant={n.read ? "secondary" : "default"} className="text-[10px] shrink-0">
                  {n.read ? "Lida" : "Pendente"}
                </Badge>
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

export default AdminNotificacoes;
