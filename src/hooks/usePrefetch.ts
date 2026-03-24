import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserStats } from "@/lib/progressDB";
import { getUserGamificationData } from "@/lib/gamification";
import { queryKeys } from "./useQueryKeys";

/**
 * Returns a prefetchRoute(path) function that, when called,
 * warms the React Query cache for the target page's data.
 * Designed to be called on mouse-enter of nav links.
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const prefetchRoute = useCallback(
    (path: string) => {
      if (!user) return;

      const opts = { staleTime: 5 * 60 * 1000 };

      switch (path) {
        case "/dashboard":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tracks.list(true),
            queryFn: async () => {
              const { data } = await supabase
                .from("tracks")
                .select("id, title, description, category, estimated_hours, is_active, order_index, prerequisite_track_id, lessons(id, duration), enrollments(id, status)")
                .eq("is_active", true)
                .order("order_index");
              return data || [];
            },
            ...opts,
          });
          break;

        case "/loja":
          queryClient.prefetchQuery({
            queryKey: ["rewards", "store", user.id],
            queryFn: async () => {
              const [gData, { data: rewardData }] = await Promise.all([
                getUserGamificationData(user.id),
                supabase.from("rewards").select("*").eq("is_active", true).order("cost"),
              ]);
              return { gamification: gData, rewards: rewardData || [] };
            },
            ...opts,
          });
          break;

        case "/insignias":
          queryClient.prefetchQuery({
            queryKey: ["badges", "page", user.id],
            queryFn: async () => {
              const [{ data: allBadges }, { data: userBadges }] = await Promise.all([
                supabase.from("badges").select("*").order("created_at"),
                supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", user.id),
              ]);
              return { badges: allBadges || [], userBadges: userBadges || [] };
            },
            ...opts,
          });
          break;

        case "/treinamento-presencial":
          queryClient.prefetchQuery({
            queryKey: queryKeys.training.modules,
            queryFn: async () => {
              const { data } = await supabase
                .from("training_modules")
                .select("*")
                .eq("is_active", true)
                .order("order_index");
              return data || [];
            },
            ...opts,
          });
          break;

        case "/ranking":
        case "/relatorios":
        case "/perfil":
          queryClient.prefetchQuery({
            queryKey: queryKeys.profile.user(user.id),
            queryFn: () =>
              supabase
                .from("profiles")
                .select("nome, cpf, empresa, cargo, avatar_url")
                .eq("user_id", user.id)
                .maybeSingle()
                .then(({ data }) => data),
            ...opts,
          });
          break;
      }
    },
    [queryClient, user]
  );

  return prefetchRoute;
}
