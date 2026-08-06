import { supabase } from "@/integrations/supabase/client";

/**
 * Escritor único de presença (`profiles.last_active_at`).
 *
 * Evidência do problema: `UPDATE public.profiles SET last_active_at = ...`
 * era a operação mais lenta por chamada do banco (média 44ms, pico 3,5s) e
 * tinha dois emissores independentes (heartbeat de presença + conclusão de
 * aula), podendo gerar 2 writes/min por usuário — ~33 writes/s com 1.000
 * usuários simultâneos.
 *
 * Correção: um único escritor, com janela mínima entre gravações e pausa
 * quando a aba não está visível.
 */
export const PRESENCE_INTERVAL_MS = 120_000;

let lastWrite = 0;
let inFlight = false;

export async function touchPresence(userId: string, force = false) {
  if (!userId) return;
  if (!force && typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const now = Date.now();
  if (!force && now - lastWrite < PRESENCE_INTERVAL_MS) return;
  if (inFlight) return;

  inFlight = true;
  lastWrite = now;
  const { error } = await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId);
  inFlight = false;
  if (error) {
    // permite nova tentativa no próximo tick sem estourar writes
    lastWrite = now - PRESENCE_INTERVAL_MS / 2;
  }
}

/** Apenas para testes. */
export function __resetPresence() {
  lastWrite = 0;
  inFlight = false;
}
