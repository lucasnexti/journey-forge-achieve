import { supabase } from "@/integrations/supabase/client";

// ── Coin amounts ──
export const COIN_REWARDS = {
  lesson_complete: 10,
  track_complete: 50,
  quiz_pass: 25,
  quiz_perfect: 40,
  streak_3: 15,
  streak_7: 50,
  daily_login: 5,
  forum_post: 5,
} as const;

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

// ── Award coins (idempotent for unique actions) ──
export async function awardCoins(
  userId: string,
  amount: number,
  reason: string,
  referenceType: string,
  referenceId?: string
) {
  // Check for duplicate award (same user, reason, reference)
  if (referenceId) {
    const { data: existing } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("reason", reason)
      .eq("reference_id", referenceId)
      .limit(1);
    if (existing && existing.length > 0) return; // Already awarded
  }

  // Use server-side secure functions
  await supabase.rpc("award_coins", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _reference_type: referenceType,
    _reference_id: referenceId ?? null,
  });

  // Update XP via server-side function
  await supabase.rpc("award_xp", { _user_id: userId, _xp: amount });
}

// ── Streak management ──
export async function updateStreak(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: streak } = await supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Use server-side streak update
  await supabase.rpc("update_user_streak", { _user_id: userId });

  // Daily login bonus
  await awardCoins(userId, COIN_REWARDS.daily_login, "Acesso diário", "daily", `daily-${today}`);

  // Re-fetch streak data after server update
  const { data: updatedStreak } = await supabase
    .from("user_streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const newStreak = updatedStreak?.current_streak || 1;
  const newLongest = updatedStreak?.longest_streak || 1;

  // Streak milestones
  if (newStreak === 3) {
    await awardCoins(userId, COIN_REWARDS.streak_3, "Streak de 3 dias", "streak", `streak3-${today}`);
  }
  if (newStreak === 7) {
    await awardCoins(userId, COIN_REWARDS.streak_7, "Streak de 7 dias", "streak", `streak7-${today}`);
  }
  if (newStreak > 7 && newStreak % 7 === 0) {
    await awardCoins(userId, COIN_REWARDS.streak_7, `Streak de ${newStreak} dias`, "streak", `streak${newStreak}-${today}`);
  }

  return { current_streak: newStreak, longest_streak: newLongest };
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
