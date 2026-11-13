import { describe, expect, it } from "vitest";
import { INTEREST_AREAS, shouldShowOnboarding, toggleInterestArea } from "./onboarding";

describe("onboarding rules", () => {
  it("shows onboarding for a profile that has not completed it", () => {
    expect(shouldShowOnboarding({ onboarding_completed: false })).toBe(true);
    expect(shouldShowOnboarding({ onboarding_completed: null })).toBe(true);
  });
  it("never shows onboarding again once completed", () => {
    expect(shouldShowOnboarding({ onboarding_completed: true })).toBe(false);
  });
  it("does not show onboarding before the profile has loaded", () => {
    expect(shouldShowOnboarding(undefined)).toBe(false);
    expect(shouldShowOnboarding(null)).toBe(false);
  });
  it("offers the ten Nexti interest areas", () => {
    expect(INTEREST_AREAS.map((a) => a.label)).toEqual([
      "Gestão de Pessoas", "Departamento Pessoal", "Controle de Jornada", "Escalas e Frequência", "Gestão de Benefícios",
      "Admissão Digital", "Gestão de Equipes", "Relatórios e Indicadores", "Gestão de Acessos", "Tecnologia e Funcionalidades Nexti",
    ]);
  });
  it("allows selecting several areas and unselecting one", () => {
    let s = toggleInterestArea([], "gestao_pessoas");
    s = toggleInterestArea(s, "controle_jornada");
    expect(s).toEqual(["gestao_pessoas", "controle_jornada"]);
    expect(toggleInterestArea(s, "gestao_pessoas")).toEqual(["controle_jornada"]);
  });
});
