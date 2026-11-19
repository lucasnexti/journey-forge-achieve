import { describe, expect, it } from "vitest";
import { moduleForCollection, redactPersonalData, wikiPassages } from "../../supabase/functions/assistant-knowledge/wiki-text";

describe("Wiki documents → passages", () => {
  it("keeps the Wiki hierarchy and headings in each passage", () => {
    const md = "Intro do documento\n\n# Cadastro\nAbra **Cadastros > Horário**.\n## Escala\nClique em [Novo](https://x).";
    const { passages } = wikiPassages(md, ["Operações", "Cadastros", "Horários"]);
    expect(passages.map((p) => p.section)).toEqual([
      "Operações › Cadastros › Horários",
      "Operações › Cadastros › Horários › Cadastro",
      "Operações › Cadastros › Horários › Cadastro › Escala",
    ]);
    expect(passages[2].content).toContain("Clique em Novo.");
  });
  it("reports images and attachments as not read", () => {
    const md = "# Tela\n![Tela de login](/api/attachments.redirect?id=1)\n[manual.pdf](/api/attachments.redirect?id=2)\nTexto";
    const r = wikiPassages(md, ["C"]);
    expect(r.unprocessed.map((u) => u.type)).toEqual(["image", "file"]);
    expect(r.passages[0].content).not.toContain("attachments");
  });
  it("splits long sections into passages of at most the limit", () => {
    const md = Array.from({ length: 40 }, (_, i) => `Linha ${i} ${"x".repeat(80)}`).join("\n");
    const { passages } = wikiPassages(md, ["C"], 500);
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((p) => p.content.length <= 500)).toBe(true);
  });
  it("drops documents that only have headings", () => {
    expect(wikiPassages("# Só título\n\n\\\n", ["C"]).passages).toEqual([]);
  });
});

describe("personal data in Wiki passages", () => {
  it("hides e-mails, CPF, CNPJ and phones but keeps the official support channels", () => {
    const t = redactPersonalData("joao.silva@cliente.com.br CPF 123.456.789-09 CNPJ 12.345.678/0001-90 tel (11) 98765-4321 suporte@nexti.com (48) 3112-1123");
    expect(t).not.toMatch(/joao|123\.456|12\.345|98765/);
    expect(t).toContain("suporte@nexti.com");
    expect(t).toContain("(48) 3112-1123");
  });
});

describe("Wiki collection → assistant module", () => {
  it("maps Talent and Admissão collections, others answer every module", () => {
    expect(moduleForCollection("Nexti Talent")).toBe("talent");
    expect(moduleForCollection("Admissão Digital")).toBe("admissao");
    expect(moduleForCollection("Operações")).toBeNull();
  });
});
