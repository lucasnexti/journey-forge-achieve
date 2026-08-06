import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert,
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

import { savePartialProgressDB } from "@/lib/progressDB";

describe("savePartialProgressDB", () => {
  beforeEach(() => upsert.mockClear());

  it("grava o progresso quando avança", async () => {
    await savePartialProgressDB("u1", "t1", "l1", 30);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("ignora gravações que não avançam o tempo já persistido", async () => {
    await savePartialProgressDB("u1", "t1", "l1", 30);
    await savePartialProgressDB("u1", "t1", "l1", 25);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("grava novamente quando o tempo avança", async () => {
    await savePartialProgressDB("u1", "t1", "l1", 60);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
