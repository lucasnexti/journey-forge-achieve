import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Award, Plus, Trash2, Save, X, Trophy, Star, Crown, Zap, MessageCircle } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy, star: Star, crown: Crown, zap: Zap, award: Award, "message-circle": MessageCircle,
};

const AdminGamificacao = () => {
  const [badges, setBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: "", description: "", icon: "award", criteria_type: "track_completion", criteria_value: 1 });
  const [showAssign, setShowAssign] = useState(false);
  const [assignData, setAssignData] = useState({ user_id: "", badge_id: "" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [badgesRes, ubRes, profilesRes] = await Promise.all([
      supabase.from("badges").select("*").order("created_at"),
      supabase.from("user_badges").select("*, badges(name, icon)").order("earned_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    if (badgesRes.data) setBadges(badgesRes.data);
    if (ubRes.data) setUserBadges(ubRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  };

  const getUserName = (uid: string) => profiles.find(p => p.user_id === uid)?.nome || uid.substring(0, 8);

  const handleCreateBadge = async () => {
    if (!newBadge.name) { toast.error("Informe o nome."); return; }
    const { error } = await supabase.from("badges").insert(newBadge);
    if (error) toast.error(error.message);
    else { toast.success("Badge criado!"); setShowNew(false); setNewBadge({ name: "", description: "", icon: "award", criteria_type: "track_completion", criteria_value: 1 }); fetchAll(); }
  };

  const handleDeleteBadge = async (id: string) => {
    if (!confirm("Excluir este badge?")) return;
    await supabase.from("badges").delete().eq("id", id);
    toast.success("Badge excluído."); fetchAll();
  };

  const handleAssignBadge = async () => {
    if (!assignData.user_id || !assignData.badge_id) { toast.error("Selecione usuário e badge."); return; }
    const { error } = await supabase.from("user_badges").insert({ user_id: assignData.user_id, badge_id: assignData.badge_id });
    if (error) toast.error(error.message);
    else { toast.success("Badge atribuído!"); setShowAssign(false); setAssignData({ user_id: "", badge_id: "" }); fetchAll(); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Gamificação</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAssign(!showAssign)} className="gap-1">
            <Award className="h-4 w-4" /> Atribuir Badge
          </Button>
          <Button onClick={() => setShowNew(!showNew)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
            {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showNew ? "Cancelar" : "Novo Badge"}
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Nome *</Label><Input value={newBadge.name} onChange={e => setNewBadge({ ...newBadge, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Ícone</Label>
              <Select value={newBadge.icon} onValueChange={v => setNewBadge({ ...newBadge, icon: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ICON_MAP).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Input value={newBadge.description} onChange={e => setNewBadge({ ...newBadge, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Critério</Label>
              <Select value={newBadge.criteria_type} onValueChange={v => setNewBadge({ ...newBadge, criteria_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="track_completion">Conclusão de trilha</SelectItem>
                  <SelectItem value="perfect_quiz">Quiz perfeito</SelectItem>
                  <SelectItem value="forum_posts">Posts no fórum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor</Label><Input type="number" value={newBadge.criteria_value} onChange={e => setNewBadge({ ...newBadge, criteria_value: Number(e.target.value) })} /></div>
          </div>
          <Button onClick={handleCreateBadge} className="bg-primary text-primary-foreground"><Save className="h-4 w-4 mr-1" /> Criar Badge</Button>
        </div>
      )}

      {showAssign && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold">Atribuir Badge Manualmente</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select value={assignData.user_id} onValueChange={v => setAssignData({ ...assignData, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={assignData.badge_id} onValueChange={v => setAssignData({ ...assignData, badge_id: v })}>
              <SelectTrigger><SelectValue placeholder="Badge" /></SelectTrigger>
              <SelectContent>{badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssignBadge} className="bg-primary text-primary-foreground">Atribuir</Button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Badges */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Badges ({badges.length})</h3>
          <div className="space-y-2">
            {badges.map(b => {
              const IconComp = ICON_MAP[b.icon] || Award;
              return (
                <div key={b.id} className="card-surface p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <IconComp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteBadge(b.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent awards */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Últimas Conquistas ({userBadges.length})</h3>
          {userBadges.length === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">Nenhuma conquista registrada.</div>
          ) : (
            <div className="space-y-2">
              {userBadges.slice(0, 20).map(ub => {
                const IconComp = ICON_MAP[ub.badges?.icon] || Award;
                return (
                  <div key={ub.id} className="card-surface p-4 flex items-center gap-3">
                    <IconComp className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{getUserName(ub.user_id)}</p>
                      <p className="text-xs text-muted-foreground">{ub.badges?.name}</p>
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">{new Date(ub.earned_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminGamificacao;
