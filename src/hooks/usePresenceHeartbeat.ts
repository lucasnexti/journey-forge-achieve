import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Updates the current user's `last_active_at` every 60 seconds.
 * This allows admins to see who is currently online.
 */
export const usePresenceHeartbeat = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const ping = async () => {
      await supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", user.id);
    };

    // Ping immediately on mount
    ping();

    // Then every 60 seconds
    const interval = setInterval(ping, 60_000);

    return () => clearInterval(interval);
  }, [user]);
};
