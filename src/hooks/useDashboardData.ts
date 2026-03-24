import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserStats, getLastWatchedLesson } from "@/lib/progressDB";
import { getUserGamificationData } from "@/lib/gamification";
import { queryKeys } from "./useQueryKeys";

// ── Tracks with lessons & enrollments ──
export function useTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.list(true),
    queryFn: async () => {
      const { data } = await supabase
        .from("tracks")
        .select("id, title, description, category, estimated_hours, is_active, order_index, prerequisite_track_id, lessons(id, duration), enrollments(id, status)")
        .eq("is_active", true)
        .order("order_index");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── User profile ──
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile.user(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, onboarding_completed, empresa, cargo, avatar_url, cpf")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}

// ── User stats ──
export function useUserStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.progress.stats(user?.id ?? ""),
    queryFn: () => getUserStats(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Last watched lesson ──
export function useLastWatched() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.progress.lastWatched(user?.id ?? ""),
    queryFn: () => getLastWatchedLesson(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

// ── Gamification data ──
export function useGamification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.gamification.data(user?.id ?? ""),
    queryFn: () => getUserGamificationData(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── All badges + user badges ──
export function useUserBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.gamification.badges(user?.id ?? ""),
    queryFn: async () => {
      const [{ data: userBadges }, { data: allBadges }] = await Promise.all([
        supabase.from("user_badges").select("badge_id").eq("user_id", user!.id),
        supabase.from("badges").select("id, name, icon"),
      ]);
      const earnedSet = new Set((userBadges || []).map((b) => b.badge_id));
      return (allBadges || []).map((b) => ({
        name: b.name,
        icon: b.icon || "award",
        earned: earnedSet.has(b.id),
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Favorites ──
export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.favorites.user(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("track_favorites")
        .select("track_id")
        .eq("user_id", user!.id);
      return new Set((data || []).map((f) => f.track_id));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Completed lesson IDs ──
export function useCompletedLessons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.progress.all(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id)
        .eq("completed", true);
      return new Set((data || []).map((lp) => lp.lesson_id));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Training modules ──
export function useTrainingModules() {
  return useQuery({
    queryKey: queryKeys.training.modules,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_modules")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ── Training requests ──
export function useTrainingRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.training.requests(user?.id ?? ""),
    queryFn: async () => {
      const { data } = await supabase
        .from("training_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Leaderboard data ──
export function useLeaderboard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.leaderboard.company(user?.id ?? ""),
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa")
        .eq("user_id", user!.id)
        .maybeSingle();

      const empresa = profile?.empresa;
      if (!empresa) return { empresa: null, ranking: [] };

      const { data: colleagues } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("empresa", empresa)
        .eq("is_active", true);

      if (!colleagues || colleagues.length === 0) return { empresa, ranking: [] };

      const userIds = colleagues.map((c) => c.user_id);
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id, status")
        .in("user_id", userIds);

      const nameMap = new Map(colleagues.map((c) => [c.user_id, c.nome]));
      const rankMap = new Map<string, { completed: number; total: number }>();

      (enrollments || []).forEach((e) => {
        const entry = rankMap.get(e.user_id) || { completed: 0, total: 0 };
        entry.total++;
        if (e.status === "completed") entry.completed++;
        rankMap.set(e.user_id, entry);
      });

      const ranking = Array.from(rankMap.entries())
        .map(([uid, stats]) => ({ user_id: uid, nome: nameMap.get(uid) || "Usuário", ...stats }))
        .sort((a, b) => b.completed - a.completed || a.total - b.total);

      return { empresa, ranking };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Badges page full data ──
export function useBadgesPageData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["badges", "page", user?.id ?? ""],
    queryFn: async () => {
      const [
        { data: allBadges },
        { data: userBadges },
        gData,
        { count: trackCount },
        { count: lessonCount },
        { count: quizCount },
        { count: forumCount },
        { data: quizAttempts },
      ] = await Promise.all([
        supabase.from("badges").select("*").order("created_at"),
        supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", user!.id),
        getUserGamificationData(user!.id),
        supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "completed"),
        supabase.from("lesson_progress").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("completed", true),
        supabase.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("passed", true),
        supabase.from("forum_posts").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("quiz_attempts").select("score").eq("user_id", user!.id).order("score", { ascending: false }).limit(1),
      ]);

      const earnedMap = new Map((userBadges || []).map((ub: any) => [ub.badge_id, ub.earned_at]));
      const badges = (allBadges || []).map((b: any) => ({
        id: b.id, name: b.name, description: b.description, icon: b.icon,
        criteria_type: b.criteria_type, criteria_value: b.criteria_value,
        earned: earnedMap.has(b.id), earned_at: earnedMap.get(b.id) || null,
      }));

      return {
        badges,
        gamification: gData,
        userProgress: {
          completedTracks: trackCount || 0,
          completedLessons: lessonCount || 0,
          quizzesPassed: quizCount || 0,
          forumPosts: forumCount || 0,
          bestQuizScore: quizAttempts?.[0]?.score || 0,
        },
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Rewards store data ──
export function useRewardsStoreData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rewards", "store", user?.id ?? ""],
    queryFn: async () => {
      const [gData, { data: rewardData }, { data: redemptionData }, { data: txData }] = await Promise.all([
        getUserGamificationData(user!.id),
        supabase.from("rewards").select("*").eq("is_active", true).order("cost"),
        supabase.from("reward_redemptions").select("id, cost, status, created_at, reward_id").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("coin_transactions").select("amount, reason, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
      ]);
      return {
        gamification: gData,
        rewards: rewardData || [],
        redemptions: redemptionData || [],
        transactions: txData || [],
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Profile page data ──
export function useProfilePageData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", "page", user?.id ?? ""],
    queryFn: async () => {
      const [{ data: profileData }, { data: badgeData }, { data: certData }] = await Promise.all([
        supabase.from("profiles").select("nome, cpf, empresa, cargo, avatar_url").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_badges").select("earned_at, badges(name, icon)").eq("user_id", user!.id),
        supabase.from("certificates").select("id, issued_at, certificate_code, tracks(title)").eq("user_id", user!.id),
      ]);
      return {
        profile: profileData || { nome: "", cpf: null, empresa: null, cargo: null, avatar_url: null },
        badges: (badgeData || []).map((b: any) => ({
          name: b.badges?.name || "", icon: b.badges?.icon || "award", earned_at: b.earned_at,
        })),
        certificates: (certData || []).map((c: any) => ({
          id: c.id, track_title: c.tracks?.title || "", issued_at: c.issued_at, certificate_code: c.certificate_code,
        })),
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
