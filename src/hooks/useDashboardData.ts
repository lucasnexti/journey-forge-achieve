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
