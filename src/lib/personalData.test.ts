import { describe, expect, it } from "vitest";
import { maskPhone, personalDataSchema } from "./personalData";

const valid = { nome: "Maria Santos", email: "maria@example.com", telefone: "(11) 99999-1234", workplace_empresa: "Nexti", cargo: "" };
describe("personal data rules", () => {
  for (const field of ["nome", "email", "telefone", "workplace_empresa"] as const) {
    it(`rejects empty and whitespace-only ${field}`, () => {
      for (const value of ["", "   "]) expect(personalDataSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    });
  }
  it("rejects malformed email", () => {
    expect(personalDataSchema.safeParse({ ...valid, email: "maria@" }).success).toBe(false);
  });
  it("accepts and masks a landline with DDD", () => {
    expect(maskPhone("1134567890")).toBe("(11) 3456-7890");
    expect(personalDataSchema.parse({ ...valid, telefone: "(11) 3456-7890" }).telefone).toBe("1134567890");
  });
  it("accepts and masks mobile with DDD", () => {
    expect(maskPhone("11999991234")).toBe("(11) 99999-1234");
    expect(personalDataSchema.parse(valid).telefone).toBe("11999991234");
  });
  it("rejects missing DDD and invalid phone length", () => {
    for (const telefone of ["999991234", "119999912", "00999991234"]) expect(personalDataSchema.safeParse({ ...valid, telefone }).success).toBe(false);
  });
  it("trims required fields before saving", () => {
    expect(personalDataSchema.parse({ ...valid, nome: " Maria Santos ", email: " maria@example.com ", workplace_empresa: " Nexti " })).toMatchObject({ nome: "Maria Santos", email: "maria@example.com", workplace_empresa: "Nexti" });
  });
});