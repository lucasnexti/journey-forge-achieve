import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { validateMaterialFile, MATERIAL_MAX_BYTES } from "./courseMaterials";

describe("validateMaterialFile", () => {
  it("accepts a PDF", () => {
    expect(validateMaterialFile({ name: "Manual.pdf", size: 1000, type: "application/pdf" })).toBeNull();
  });
  it("rejects executables", () => {
    expect(validateMaterialFile({ name: "x.exe", size: 10, type: "application/x-msdownload" })).not.toBeNull();
  });
  it("rejects a renamed file whose type does not match", () => {
    expect(validateMaterialFile({ name: "fake.pdf", size: 10, type: "image/png" })).not.toBeNull();
  });
  it("rejects files over 50 MB", () => {
    expect(validateMaterialFile({ name: "a.pdf", size: MATERIAL_MAX_BYTES + 1, type: "application/pdf" })).not.toBeNull();
  });
});
