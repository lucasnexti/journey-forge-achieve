import { supabase } from "@/integrations/supabase/client";

/**
 * Todas as concessões de moedas/XP acontecem no servidor.
 * O cliente apenas "reivindica" uma conquista informando a chave da regra e
 * a evidência (id da aula, trilha, quiz...). O banco valida a evidência,
 * aplica o valor oficial e garante idempotência.
 */
export type CoinRuleKey =
  | "lesson_complete"
  | "track_complete"
  | "exam_pass"
  | "exam_perfect"
  | "quiz_pass"
  | "quiz_perfect"
  | "daily_login"
  | "streak_3"
  | "streak_7"
  | "forum_post";

// Valores exibidos na UI (fonte de verdade continua sendo public.coin_rules)
export const COIN_REWARDS: Record<CoinRuleKey, number> = {
  lesson_complete: 10,
  track_complete: 50,
  exam_pass: 25,
  exam_perfect: 40,
  quiz_pass: 25,
  quiz_perfect: 40,
  daily_login: 5,
  streak_3: 15,
  streak_7: 50,
  forum_post: 5,
};

export async function loadCoinRules() {
  const { data } = await supabase.from("coin_rules").select("key, label, amount").eq("is_active", true);
  (data ?? []).forEach((r) => {
    if (r.key in COIN_REWARDS) COIN_REWARDS[r.key as CoinRuleKey] = r.amount;
  });
  return COIN_REWARDS;
}

// ── Level thresholds ──
export const LEVELS = [
  { level: 1, xp: 0, title: "Iniciante" },
  { level: 2, xp: 100, title: "Aprendiz" },
  { level: 3, xp: 300, title: "Dedicado" },
  { level: 4, xp: 600, title: "Avançado" },
  { level: 5, xp: 1000, title: "Expert" },
  { level: 6, xp: 2000, title: "Mestre Nexti" },
] as const;

export function getLevelInfo(xp: number) {
  let current = LEVELS[0] as (typeof LEVELS)[number];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progressToNext = next
    ? Math.min(100, Math.round(((xp - current.xp) / (next.xp - current.xp)) * 100))
    : 100;
  return { ...current, nextLevel: next, progressToNext, totalXp: xp };
}

export interface ClaimResult {
  ok: boolean;
  duplicate: boolean;
  amount: number;
  error?: string;
}

/** Reivindica uma recompensa — o servidor valida a evidência e o valor. */
export async function claimReward(key: CoinRuleKey, referenceId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_coin_reward", {
    _key: key,
    _reference_id: referenceId,
  });
  if (error) return { ok: false, duplicate: false, amount: 0, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; duplicate?: boolean; amount?: number; error?: string };
  return {
    ok: !!res.ok,
    duplicate: !!res.duplicate,
    amount: res.amount ?? 0,
    error: res.error,
  };
}

/** Reavalia badges no servidor; retorna apenas os realmente conquistados. */
export async function evaluateBadges(): Promise<{ id: string; name: string; icon: string | null }[]> {
  const { data, error } = await supabase.rpc("evaluate_user_badges");
  if (error) return [];
  return ((data as any)?.earned ?? []) as { id: string; name: string; icon: string | null }[];
}

// ── Streak management (servidor) ──
export async function updateStreak(_userId?: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase.rpc("touch_my_streak");
  const streak = (data ?? {}) as { current_streak?: number; longest_streak?: number };
  const current = streak.current_streak ?? 1;
  const longest = streak.longest_streak ?? 1;

  await claimReward("daily_login", `daily-${today}`);
  if (current >= 3) await claimReward("streak_3", `streak3-${today}`);
  if (current >= 7) await claimReward("streak_7", `streak7-${today}`);

  return { current_streak: current, longest_streak: longest };
}

// ── Get user gamification data ──
export async function getUserGamificationData(userId: string) {
  const [{ data: levelData }, { data: streakData }, balanceResult] = await Promise.all([
    supabase.from("user_levels").select("total_xp, current_level").eq("user_id", userId).maybeSingle(),
    supabase.from("user_streaks").select("current_streak, longest_streak").eq("user_id", userId).maybeSingle(),
    supabase.rpc("get_user_coins", { _user_id: userId }),
  ]);

  return {
    coins: (balanceResult.data as number) || 0,
    xp: levelData?.total_xp || 0,
    level: levelData?.current_level || 1,
    streak: streakData?.current_streak || 0,
    longestStreak: streakData?.longest_streak || 0,
  };
}
