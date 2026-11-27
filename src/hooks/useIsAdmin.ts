import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface MyEnvironment {
  company_id: string | null;
  company_name: string | null;
  role: "admin" | "member" | null;
  is_master: boolean;
}

/**
 * Papéis do usuário logado.
 * - isAdmin: administrador Nexti (papel global "admin", mantém as ferramentas da Nexti)
 * - isMaster: vê e gerencia todos os ambientes
 * - isCompanyAdmin: administrador do próprio ambiente (cliente)
 * - canAccessAdmin: pode abrir a área administrativa
 * O servidor sempre revalida essas permissões; aqui é só para a interface.
 */
export const useIsAdmin = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["my-access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [roles, env] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.rpc("my_environment" as never),
      ]);
      const list = (roles.data ?? []).map((r) => r.role as string);
      const environment = (env.data ?? null) as MyEnvironment | null;
      return { roles: list, environment };
    },
  });

  const roles = query.data?.roles ?? [];
  const environment = query.data?.environment ?? null;
  const isAdmin = roles.includes("admin");
  const isMaster = roles.includes("master") || !!environment?.is_master;
  const isCompanyAdmin = environment?.role === "admin";
  const loading = user ? query.isLoading : false;

  return {
    isAdmin,
    isMaster,
    isCompanyAdmin,
    canAccessAdmin: isAdmin || isMaster || isCompanyAdmin,
    environment,
    loading,
  };
};
