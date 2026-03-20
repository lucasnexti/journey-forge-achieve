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
  let current = LEVELS[0];
  let next = LEVELS[1];
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

  await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount,
    reason,
    reference_type: referenceType,
    reference_id: referenceId,
  });

  // Update XP
  const { data: levelData } = await supabase
    .from("user_levels")
    .select("total_xp")
    .eq("user_id", userId)
    .maybeSingle();

  const newXp = (levelData?.total_xp || 0) + amount;
  const newLevel = getLevelInfo(newXp).level;

  await supabase.from("user_levels").upsert(
    { user_id: userId, total_xp: newXp, current_level: newLevel, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}

// ── Streak management ──
export async function updateStreak(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: streak } = await supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!streak) {
    // First visit
    await supabase.from("user_streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    // Daily login bonus
    await awardCoins(userId, COIN_REWARDS.daily_login, "Acesso diário", "daily", `daily-${today}`);
    return { current_streak: 1, longest_streak: 1 };
  }

  if (streak.last_active_date === today) {
    return { current_streak: streak.current_streak, longest_streak: streak.longest_streak };
  }

  const lastDate = new Date(streak.last_active_date + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  let newStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, streak.longest_streak);

  await supabase
    .from("user_streaks")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Daily login bonus
  await awardCoins(userId, COIN_REWARDS.daily_login, "Acesso diário", "daily", `daily-${today}`);

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
