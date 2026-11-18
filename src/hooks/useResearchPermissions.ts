import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ResearchPermission } from "@/lib/research";

/** Permissões do menu Pesquisas e Indicadores (confirmadas no servidor a cada ação). */
export function useResearchPermissions() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["research-permissions", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("research_my_permissions");
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
  const perms = q.data ?? [];
  return {
    loading: !!user && q.isLoading,
    hasAny: perms.length > 0,
    isAdmin: perms.includes("admin"),
    can: (p: ResearchPermission) => perms.includes(p),
  };
}
