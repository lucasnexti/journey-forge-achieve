import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Gift, Plus, Pencil, Trash2, Package, CheckCircle2, XCircle, Coins } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Reward {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cost: number;
  stock: number | null;
  is_active: boolean;
  category: string | null;
}

interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  cost: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  profiles?: { nome: string } | null;
  rewards?: { name: string } | null;
}

const AdminRewards = () => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [form, setForm] = useState({ name: "", description: "", cost: 100, stock: "", category: "geral", image_url: "" });

  const load = async () => {
    const [{ data: rewardData }, { data: redemptionData }] = await Promise.all([
      supabase.from("rewards").select("*").order("created_at", { ascending: false }),
      supabase
        .from("reward_redemptions")
        .select("*, profiles:user_id(nome), rewards:reward_id(name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setRewards((rewardData as Reward[]) || []);
    setRedemptions((redemptionData as unknown as Redemption[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveReward = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      cost: form.cost,
      stock: form.stock ? parseInt(form.stock) : null,
      category: form.category,
      image_url: form.image_url || null,
      is_active: true,
    };

    if (editingReward) {
      await supabase.from("rewards").update(payload).eq("id", editingReward.id);
      toast.success("Prêmio atualizado!");
    } else {
      await supabase.from("rewards").insert(payload);
      toast.success("Prêmio criado!");
    }

    setShowForm(false);
    setEditingReward(null);
    setForm({ name: "", description: "", cost: 100, stock: "", category: "geral", image_url: "" });
    load();
  };

  const handleDeleteReward = async (id: string) => {
    await supabase.from("rewards").update({ is_active: false }).eq("id", id);
    toast.success("Prêmio desativado.");
    load();
  };

  const handleUpdateRedemptionStatus = async (id: string, status: string) => {
    await supabase.from("reward_redemptions").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

    if (status === "rejected") {
      // Refund coins
      const redemption = redemptions.find((r) => r.id === id);
      if (redemption) {
        await supabase.from("coin_transactions").insert({
          user_id: redemption.user_id,
          amount: redemption.cost,
          reason: `Reembolso: resgate rejeitado`,
          reference_type: "refund",
          reference_id: id,
        });
      }
    }

    toast.success(`Resgate ${status === "approved" ? "aprovado" : status === "delivered" ? "marcado como entregue" : "rejeitado"}!`);
    load();
  };

  const openEdit = (reward: Reward) => {
    setEditingReward(reward);
    setForm({
      name: reward.name,
      description: reward.description || "",
      cost: reward.cost,
      stock: reward.stock?.toString() || "",
      category: reward.category || "geral",
      image_url: reward.image_url || "",
    });
    setShowForm(true);
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "bg-warning/10 text-warning" },
    approved: { label: "Aprovado", color: "bg-primary/10 text-primary" },
    delivered: { label: "Entregue", color: "bg-green-500/10 text-green-600" },
    rejected: { label: "Rejeitado", color: "bg-destructive/10 text-destructive" },
  };

  const pendingCount = redemptions.filter((r) => r.status === "pending").length;

  return (
    <AdminPageShell
      title="Prêmios & Resgates"
      subtitle={`${rewards.filter((r) => r.is_active).length} prêmios ativos · ${pendingCount} resgates pendentes`}
      icon={Gift}
    >
      {/* Rewards Management */}
      <div className="card-surface p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Catálogo de Prêmios
          </h3>
          <Button
            size="sm"
            onClick={() => { setEditingReward(null); setForm({ name: "", description: "", cost: 100, stock: "", category: "geral", image_url: "" }); setShowForm(true); }}
            className="gap-1.5 bg-gradient-nexti text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo Prêmio
          </Button>
        </div>

        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {rewards.map((reward) => (
              <div key={reward.id} className={`flex items-center justify-between rounded-lg border border-border/50 p-3 gap-3 ${!reward.is_active ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{reward.name}</p>
                    {!reward.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-yellow-600 font-bold">{reward.cost} 🪙</span>
                    {reward.stock !== null && ` · Estoque: ${reward.stock}`}
                    {reward.category && ` · ${reward.category}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(reward)} className="h-8 w-8 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {reward.is_active && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteReward(reward.id)} className="h-8 w-8 p-0 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redemptions */}
      <div className="card-surface p-4 sm:p-6">
        <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Resgates ({redemptions.length})
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">{pendingCount} pendentes</Badge>
          )}
        </h3>

        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resgate realizado.</p>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => {
              const st = statusLabels[r.status] || statusLabels.pending;
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(r.profiles as any)?.nome || "Usuário"} → {(r.rewards as any)?.name || "Prêmio"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.cost} moedas
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => handleUpdateRedemptionStatus(r.id, "approved")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleUpdateRedemptionStatus(r.id, "rejected")}>
                          <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateRedemptionStatus(r.id, "delivered")}>
                        Marcar entregue
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reward Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReward ? "Editar Prêmio" : "Novo Prêmio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do prêmio" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição do prêmio" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Custo (moedas) *</Label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Estoque (vazio = ilimitado)</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="∞" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex: acessório, experiência" />
            </div>
            <div className="space-y-1.5">
              <Label>URL da imagem</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveReward} disabled={!form.name} className="bg-gradient-nexti text-primary-foreground hover:opacity-90">
              {editingReward ? "Salvar" : "Criar Prêmio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminRewards;
