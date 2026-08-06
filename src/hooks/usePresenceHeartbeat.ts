import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PRESENCE_INTERVAL_MS, touchPresence } from "@/lib/presence";

/**
 * Mantém `last_active_at` atualizado para o painel de usuários online.
 * Usa o escritor único de presença: no máximo 1 write a cada 2 minutos por
 * usuário e nenhum write com a aba em segundo plano.
 */
export const usePresenceHeartbeat = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    void touchPresence(user.id, true);

    const interval = setInterval(() => void touchPresence(user.id), PRESENCE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void touchPresence(user.id);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);
};
