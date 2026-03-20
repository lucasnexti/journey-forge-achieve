import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserGamificationData, getLevelInfo, LEVELS } from "@/lib/gamification";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Coins, Flame, TrendingUp, ShoppingBag, Gift, Clock, CheckCircle2, Package } from "lucide-react";

interface Reward {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cost: number;
  stock: number | null;
  category: string | null;
}

interface Redemption {
  id: string;
  cost: number;
  status: string;
  created_at: string;
  reward_id: string;
}

const RewardsStorePage = () => {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [gamification, setGamification] = useState({ coins: 0, xp: 0, level: 1, streak: 0, longestStreak: 0 });
  const [transactions, setTransactions] = useState<{ amount: number; reason: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"store" | "history">("store");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [gData, { data: rewardData }, { data: redemptionData }, { data: txData }] = await Promise.all([
        getUserGamificationData(user.id),
        supabase.from("rewards").select("*").eq("is_active", true).order("cost"),
        supabase.from("reward_redemptions").select("id, cost, status, created_at, reward_id").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("coin_transactions").select("amount, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setGamification(gData);
      setRewards((rewardData as Reward[]) || []);
      setRedemptions((redemptionData as Redemption[]) || []);
      setTransactions(txData || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleRedeem = async (reward: Reward) => {
    if (!user) return;
    if (gamification.coins < reward.cost) {
      toast.error("Moedas insuficientes para este prêmio.");
      return;
    }

    setRedeeming(reward.id);

    // Deduct coins
    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: -reward.cost,
      reason: `Resgate: ${reward.name}`,
      reference_type: "redemption",
      reference_id: reward.id,
    });

    // Create redemption
    await supabase.from("reward_redemptions").insert({
      user_id: user.id,
      reward_id: reward.id,
      cost: reward.cost,
    });

    setGamification((prev) => ({ ...prev, coins: prev.coins - reward.cost }));
    toast.success(`🎉 Prêmio "${reward.name}" resgatado! Aguarde a aprovação.`);
    setRedeeming(null);

    // Refresh redemptions
    const { data: newRedemptions } = await supabase
      .from("reward_redemptions")
      .select("id, cost, status, created_at, reward_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRedemptions(newRedemptions || []);
  };

  const levelInfo = getLevelInfo(gamification.xp);
  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "bg-warning/10 text-warning" },
    approved: { label: "Aprovado", color: "bg-primary/10 text-primary" },
    delivered: { label: "Entregue", color: "bg-green-500/10 text-green-600" },
    rejected: { label: "Recusado", color: "bg-destructive/10 text-destructive" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-4 sm:py-8">
        {/* Gamification Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Coins */}
          <div className="card-surface p-4 text-center">
            <Coins className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">{gamification.coins}</p>
            <p className="text-[10px] text-muted-foreground">Nexti Coins</p>
          </div>
          {/* Level */}
          <div className="card-surface p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-display font-extrabold text-foreground">{levelInfo.level}</p>
            <p className="text-[10px] text-muted-foreground">{levelInfo.title}</p>
            <Progress value={levelInfo.progressToNext} className="h-1 mt-2" />
          </div>
          {/* Streak */}
          <div className="card-surface p-4 text-center">
            <Flame className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">{gamification.streak}</p>
            <p className="text-[10px] text-muted-foreground">Dias seguidos</p>
          </div>
          {/* XP */}
          <div className="card-surface p-4 text-center">
            <Gift className="h-6 w-6 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">{gamification.xp}</p>
            <p className="text-[10px] text-muted-foreground">XP Total</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "store" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("store")}
            className={activeTab === "store" ? "bg-gradient-nexti text-primary-foreground" : ""}
          >
            <ShoppingBag className="h-4 w-4 mr-1.5" />
            Loja de Prêmios
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className={activeTab === "history" ? "bg-gradient-nexti text-primary-foreground" : ""}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Histórico
          </Button>
        </div>

        {activeTab === "store" ? (
          <>
            {rewards.length === 0 ? (
              <div className="card-surface p-12 text-center">
                <Gift className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum prêmio disponível no momento.</p>
                <p className="text-xs text-muted-foreground mt-1">Continue acumulando moedas!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {rewards.map((reward, i) => {
                  const canAfford = gamification.coins >= reward.cost;
                  const outOfStock = reward.stock !== null && reward.stock <= 0;
                  return (
                    <motion.div
                      key={reward.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card-surface overflow-hidden flex flex-col"
                    >
                      {/* Image placeholder */}
                      <div className="h-32 sm:h-40 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                        {reward.image_url ? (
                          <img src={reward.image_url} alt={reward.name} className="h-full w-full object-cover" />
                        ) : (
                          <Gift className="h-12 w-12 text-primary/30" />
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        {reward.category && (
                          <Badge variant="secondary" className="text-[10px] w-fit mb-2">{reward.category}</Badge>
                        )}
                        <h3 className="font-display text-sm font-semibold text-foreground">{reward.name}</h3>
                        {reward.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reward.description}</p>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-sm font-bold text-yellow-600 dark:text-yellow-400">
                            <Coins className="h-4 w-4" />
                            {reward.cost}
                          </span>
                          <Button
                            size="sm"
                            disabled={!canAfford || outOfStock || redeeming === reward.id}
                            onClick={() => handleRedeem(reward)}
                            className={canAfford && !outOfStock ? "bg-gradient-nexti text-primary-foreground hover:opacity-90" : ""}
                          >
                            {outOfStock ? "Esgotado" : redeeming === reward.id ? "..." : canAfford ? "Resgatar" : "Moedas insuf."}
                          </Button>
                        </div>
                        {reward.stock !== null && (
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">{reward.stock} restantes</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* Redemptions */}
            {redemptions.length > 0 && (
              <div className="card-surface p-4 sm:p-6">
                <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Meus Resgates
                </h3>
                <div className="space-y-2">
                  {redemptions.map((r) => {
                    const reward = rewards.find((rw) => rw.id === r.reward_id);
                    const st = statusLabels[r.status] || statusLabels.pending;
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{reward?.name || "Prêmio"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.cost} moedas
                          </p>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${st.color}`}>
                          {st.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transaction history */}
            <div className="card-surface p-4 sm:p-6">
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-500" />
                Histórico de Moedas
              </h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{tx.reason}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardsStorePage;
