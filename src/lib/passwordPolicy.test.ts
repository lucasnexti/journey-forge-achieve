import { describe, it, expect } from "vitest";
import { isStrongPassword } from "./passwordPolicy";

describe("isStrongPassword", () => {
  it("aceita senha com 8+, maiúscula, minúscula, número e especial", () => expect(isStrongPassword("Nexti@2026")).toBe(true));
  it("recusa menos de 8 caracteres", () => expect(isStrongPassword("Ne@1abc")).toBe(false));
  it("recusa sem maiúscula", () => expect(isStrongPassword("nexti@2026")).toBe(false));
  it("recusa sem número", () => expect(isStrongPassword("Nexti@abcd")).toBe(false));
  it("recusa sem letras minúsculas", () => expect(isStrongPassword("NEXTI@2026")).toBe(false));
  it("recusa sem caractere especial", () => expect(isStrongPassword("Nexti2026a")).toBe(false));
});
