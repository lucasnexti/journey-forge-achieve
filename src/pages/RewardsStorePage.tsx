import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserGamificationData, getLevelInfo } from "@/lib/gamification";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, Flame, TrendingUp, ShoppingBag, Gift, Clock,
  Package, Star, Zap, Crown, ArrowRight, Sparkles,
} from "lucide-react";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    await supabase.from("coin_transactions").insert({
      user_id: user.id, amount: -reward.cost,
      reason: `Resgate: ${reward.name}`, reference_type: "redemption", reference_id: reward.id,
    });
    await supabase.from("reward_redemptions").insert({
      user_id: user.id, reward_id: reward.id, cost: reward.cost,
    });
    setGamification((prev) => ({ ...prev, coins: prev.coins - reward.cost }));
    toast.success(`🎉 Prêmio "${reward.name}" resgatado! Aguarde a aprovação.`);
    setRedeeming(null);
    const { data: newRedemptions } = await supabase
      .from("reward_redemptions")
      .select("id, cost, status, created_at, reward_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRedemptions(newRedemptions || []);
  };

  const levelInfo = getLevelInfo(gamification.xp);
  const categories = [...new Set(rewards.map((r) => r.category).filter(Boolean))] as string[];
  const filteredRewards = selectedCategory
    ? rewards.filter((r) => r.category === selectedCategory)
    : rewards;

  const statusLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    pending: { label: "Pendente", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-warning/10 text-warning border-warning/20" },
    approved: { label: "Aprovado", icon: <Star className="h-3.5 w-3.5" />, color: "bg-primary/10 text-primary border-primary/20" },
    delivered: { label: "Entregue", icon: <Package className="h-3.5 w-3.5" />, color: "bg-success/10 text-success border-success/20" },
    rejected: { label: "Recusado", icon: <Zap className="h-3.5 w-3.5" />, color: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </AppLayout>
        <div className="container relative py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-primary-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Loja Nexti
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                Troque suas moedas por prêmios exclusivos
              </p>
            </div>

            {/* Coin Balance Pill */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-5 py-3"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/20">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-display font-extrabold text-primary-foreground tabular-nums leading-none">
                  {gamification.coins.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-primary-foreground/70 font-medium">Nexti Coins</p>
              </div>
            </motion.div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Crown className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs font-semibold text-primary-foreground/80">Nível</span>
              </div>
              <p className="text-lg font-display font-extrabold text-primary-foreground leading-none">{levelInfo.level}</p>
              <p className="text-[10px] text-primary-foreground/60 mt-0.5">{levelInfo.title}</p>
              <Progress value={levelInfo.progressToNext} className="h-1 mt-2 bg-white/20 [&>div]:bg-white" />
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Flame className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs font-semibold text-primary-foreground/80">Streak</span>
              </div>
              <p className="text-lg font-display font-extrabold text-primary-foreground leading-none tabular-nums">{gamification.streak}</p>
              <p className="text-[10px] text-primary-foreground/60 mt-0.5">dias seguidos</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <TrendingUp className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs font-semibold text-primary-foreground/80">XP</span>
              </div>
              <p className="text-lg font-display font-extrabold text-primary-foreground leading-none tabular-nums">{gamification.xp.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-primary-foreground/60 mt-0.5">experiência total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-5 sm:py-8">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 w-fit mb-6">
          <button
            onClick={() => setActiveTab("store")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "store"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Prêmios
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "history"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            Histórico
            {redemptions.length > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {redemptions.length}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "store" ? (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      !selectedCategory
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {filteredRewards.length === 0 ? (
                <div className="card-surface p-16 text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Gift className="h-8 w-8 text-primary/40" />
                  </div>
                  <p className="text-foreground font-semibold">Nenhum prêmio disponível</p>
                  <p className="text-sm text-muted-foreground mt-1">Continue acumulando moedas! Novos prêmios em breve.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRewards.map((reward, i) => {
                    const canAfford = gamification.coins >= reward.cost;
                    const outOfStock = reward.stock !== null && reward.stock <= 0;
                    const affordPercent = Math.min(100, (gamification.coins / reward.cost) * 100);

                    return (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="group card-surface-hover overflow-hidden flex flex-col"
                      >
                        {/* Image */}
                        <div className="relative h-40 sm:h-44 bg-gradient-to-br from-muted/80 to-muted flex items-center justify-center overflow-hidden">
                          {reward.image_url ? (
                            <img
                              src={reward.image_url}
                              alt={reward.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Gift className="h-8 w-8 text-primary/30" />
                              </div>
                            </div>
                          )}

                          {/* Stock badge */}
                          {reward.stock !== null && reward.stock > 0 && reward.stock <= 5 && (
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-destructive/90 text-destructive-foreground text-[10px] border-0 shadow-sm">
                                Últimas {reward.stock} unidades!
                              </Badge>
                            </div>
                          )}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                              <Badge className="bg-muted text-muted-foreground text-xs border-0">Esgotado</Badge>
                            </div>
                          )}

                          {/* Category pill */}
                          {reward.category && (
                            <div className="absolute top-3 right-3">
                              <Badge variant="secondary" className="text-[10px] bg-card/80 backdrop-blur-sm border-0 shadow-sm">
                                {reward.category}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-display text-sm font-bold text-foreground leading-snug">{reward.name}</h3>
                          {reward.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{reward.description}</p>
                          )}

                          <div className="mt-auto pt-4 space-y-3">
                            {/* Price & afford progress */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                                  <Coins className="h-4 w-4 text-warning" />
                                  {reward.cost.toLocaleString("pt-BR")}
                                </span>
                                {!canAfford && (
                                  <span className="text-[10px] text-muted-foreground">
                                    faltam {(reward.cost - gamification.coins).toLocaleString("pt-BR")}
                                  </span>
                                )}
                              </div>
                              {!canAfford && (
                                <Progress value={affordPercent} className="h-1.5 bg-muted [&>div]:bg-gradient-nexti" />
                              )}
                            </div>

                            <Button
                              size="sm"
                              disabled={!canAfford || outOfStock || redeeming === reward.id}
                              onClick={() => handleRedeem(reward)}
                              className={`w-full h-9 text-xs font-bold ${
                                canAfford && !outOfStock
                                  ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 shadow-sm"
                                  : ""
                              }`}
                            >
                              {outOfStock ? (
                                "Esgotado"
                              ) : redeeming === reward.id ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                  Resgatando...
                                </span>
                              ) : canAfford ? (
                                <span className="flex items-center gap-1.5">
                                  Resgatar
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                "Moedas insuficientes"
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Redemptions */}
              {redemptions.length > 0 && (
                <div className="card-surface p-5 sm:p-6">
                  <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Meus Resgates
                  </h3>
                  <div className="space-y-2.5">
                    {redemptions.map((r, i) => {
                      const reward = rewards.find((rw) => rw.id === r.reward_id);
                      const st = statusLabels[r.status] || statusLabels.pending;
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5 bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Gift className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{reward?.name || "Prêmio"}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.cost.toLocaleString("pt-BR")} moedas
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 gap-1 ${st.color}`}>
                            {st.icon}
                            {st.label}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Transaction history */}
              <div className="card-surface p-5 sm:p-6">
                <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-warning" />
                  Histórico de Moedas
                </h3>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Coins className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {transactions.map((tx, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0"
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          tx.amount > 0 ? "bg-success/10" : "bg-destructive/10"
                        }`}>
                          {tx.amount > 0 ? (
                            <TrendingUp className="h-4 w-4 text-success" />
                          ) : (
                            <ShoppingBag className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{tx.reason}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${
                          tx.amount > 0 ? "text-success" : "text-destructive"
                        }`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RewardsStorePage;
