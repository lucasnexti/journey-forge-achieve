import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update }) },
}));

import { touchPresence, __resetPresence, PRESENCE_INTERVAL_MS } from "@/lib/presence";

describe("touchPresence", () => {
  beforeEach(() => {
    update.mockClear();
    __resetPresence();
    vi.useRealTimers();
  });

  it("grava uma vez e ignora chamadas dentro da janela", async () => {
    await touchPresence("u1", true);
    await touchPresence("u1");
    await touchPresence("u1");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("volta a gravar depois da janela", async () => {
    await touchPresence("u1", true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + PRESENCE_INTERVAL_MS + 1000);
    await touchPresence("u1", true);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("não grava sem usuário", async () => {
    await touchPresence("");
    expect(update).not.toHaveBeenCalled();
  });
});
