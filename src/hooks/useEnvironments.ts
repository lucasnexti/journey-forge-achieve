import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Environment { id: string; name: string; slug: string | null; is_active: boolean }

/** Ambientes que o usuário pode ver (o Master vê todos). */
export function useEnvironments(enabled = true) {
  return useQuery({
    queryKey: ["environments"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_companies").select("id,name,slug,is_active").order("name");
      if (error) throw error;
      return (data ?? []) as Environment[];
    },
  });
}
