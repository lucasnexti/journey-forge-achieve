import { describe, expect, it } from "vitest";
import { needsSupportHint, NOT_FOUND, parseAnswer, type CandidateSource } from "./nextiAssistant";

const src = (n: number, page: string, title = `Página ${page}`): CandidateSource => ({
  n, page_id: page, title, section: "", url: `https://notion.so/${page}`, updated_at: null, orientation_path: null, orientation_title: null,
});
const candidates = [src(1, "a"), src(2, "b"), src(3, "a"), src(4, "c")];

describe("parseAnswer", () => {
  it("shows only the pages the answer cites", () => {
    const r = parseAnswer("1. Abra o menu Cadastros.\nFONTES: 2, 4", candidates);
    expect(r.body).toBe("1. Abra o menu Cadastros.");
    expect(r.pages.map((p) => p.page_id)).toEqual(["b", "c"]);
  });
  it("lists a page once even when two of its sections are cited", () => {
    expect(parseAnswer("Resposta\nFONTES: 1, 3", candidates).pages.map((p) => p.page_id)).toEqual(["a"]);
  });
  it("shows no source when the model cites none", () => {
    expect(parseAnswer("Você se refere à escala ou ao horário?\nFONTES: nenhuma", candidates).pages).toEqual([]);
  });
  it("never cites numbers that were not retrieved", () => {
    expect(parseAnswer("Resposta\nFONTES: 9", candidates).pages).toEqual([]);
  });
  it("shows no source on the not-found answer", () => {
    const r = parseAnswer(`${NOT_FOUND}\nFONTES: 1`, candidates);
    expect(r.notFound).toBe(true);
    expect(r.pages).toEqual([]);
  });
  it("links each cited material to the Nexti na Prática guides its passages came from, once each", () => {
    const withGuides: CandidateSource[] = [
      { ...src(1, "octadesk:escala", "Cadastro Horário e Escala Completo"), provider: "octadesk", orientation_path: "cadastros/escala/x", orientation_title: "Escala e horário" },
      { ...src(2, "octadesk:escala", "Cadastro Horário e Escala Completo"), provider: "octadesk", orientation_path: "cadastros/escala/x", orientation_title: "Escala e horário" },
      { ...src(3, "octadesk:escala", "Cadastro Horário e Escala Completo"), provider: "octadesk" },
    ];
    const r = parseAnswer("Resposta\nFONTES: 1, 2, 3", withGuides);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].provider).toBe("octadesk");
    expect(r.pages[0].orientations).toEqual([{ path: "cadastros/escala/x", title: "Escala e horário" }]);
  });
  it("hides a partial sources marker while streaming", () => {
    expect(parseAnswer("Resposta\nFON", candidates, true).body).toBe("Resposta");
  });
});

describe("needsSupportHint", () => {
  it("points to support only after a second not-found in a row", () => {
    expect(needsSupportHint([true], 0)).toBe(false);
    expect(needsSupportHint([true, true], 1)).toBe(true);
    expect(needsSupportHint([false, true], 1)).toBe(false);
  });
});
