import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setCheckedUserId(null);
      return;
    }

    let cancelled = false;

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(!!data && !error);
      setCheckedUserId(user.id);
    };

    checkAdmin();
    return () => { cancelled = true; };
  }, [user]);

  // Enquanto o papel do usuário logado ainda não foi verificado, seguimos carregando
  const loading = user ? checkedUserId !== user.id : false;

  return { isAdmin, loading };
};
