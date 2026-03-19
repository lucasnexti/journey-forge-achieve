import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Send, Plus, X } from "lucide-react";

const AdminNotificacoes = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: "", message: "", type: "info", target: "all" as string });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [notifsRes, profilesRes] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    if (notifsRes.data) setNotifications(notifsRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  };

  const getUserName = (uid: string) => profiles.find(p => p.user_id === uid)?.nome || uid.substring(0, 8);

  const handleSend = async () => {
    if (!newNotif.title || !newNotif.message) { toast.error("Preencha título e mensagem."); return; }

    const targetUsers = newNotif.target === "all"
      ? profiles.map(p => p.user_id)
      : [newNotif.target];

    const inserts = targetUsers.map(uid => ({
      user_id: uid,
      title: newNotif.title,
      message: newNotif.message,
      type: newNotif.type,
    }));

    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) { toast.error(error.message); return; }
    toast.success(`Notificação enviada para ${targetUsers.length} usuário(s)!`);
    setShowNew(false);
    setNewNotif({ title: "", message: "", type: "info", target: "all" });
    fetchAll();

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "send_notification",
      entity_type: "notification",
      details: { title: newNotif.title, recipients: targetUsers.length },
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

      {showNew && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Título *</Label><Input value={newNotif.title} onChange={e => setNewNotif({ ...newNotif, title: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={newNotif.target} onValueChange={v => setNewNotif({ ...newNotif, target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Mensagem *</Label><Textarea value={newNotif.message} onChange={e => setNewNotif({ ...newNotif, message: e.target.value })} rows={3} /></div>
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
          <Button onClick={handleSend} className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-1" /> Enviar</Button>
        </div>
      )}

      <div className="mt-6 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação enviada.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map(n => (
              <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                  n.type === "warning" ? "bg-warning/10" : n.type === "success" ? "bg-success/10" : "bg-primary/10"
                }`}>
                  <Bell className={`h-4 w-4 ${n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{getUserName(n.user_id)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${n.read ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                  {n.read ? "Lida" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotificacoes;
