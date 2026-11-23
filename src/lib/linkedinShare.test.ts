import { describe, it, expect } from "vitest";
import { buildSuggestedPost, certificateVerifyUrl, certificateImageFileName, linkedInComposerUrl, linkedInAddToProfileUrl } from "./linkedinShare";

describe("Compartilhamento no LinkedIn", () => {
  it("texto sugerido traz o nome do treinamento e as hashtags pedidas", () => {
    const t = buildSuggestedPost("Compliance Trabalhista");
    expect(t).toContain("Concluí o treinamento Compliance Trabalhista pela Nexti Academy");
    expect(t.startsWith("Mais uma conquista na minha jornada de desenvolvimento profissional! 🎓")).toBe(true);
    expect(t.endsWith("#DesenvolvimentoProfissional #AprendizadoContínuo #NextiAcademy")).toBe(true);
  });

  it("o texto da publicação não leva link da plataforma nem do certificado", () => {
    const t = buildSuggestedPost("Curso X");
    expect(t).not.toMatch(/https?:\/\//);
    expect(t).not.toContain("lovable");
    expect(t).not.toContain("validar-certificado");
  });

  it("link de validação continua disponível para o perfil do LinkedIn", () => {
    expect(certificateVerifyUrl("ABC123")).toBe("https://journey-forge-achieve.lovable.app/validar-certificado/ABC123");
    expect(certificateVerifyUrl("   ")).toBeNull();
    expect(certificateVerifyUrl(null)).toBeNull();
  });

  it("a imagem do certificado é um PNG com o nome do treinamento", () => {
    expect(certificateImageFileName("Compliance Trabalhista")).toBe("certificado-nexti-academy-compliance-trabalhista.png");
    expect(certificateImageFileName("ISO – Inteligência Artificial")).toBe("certificado-nexti-academy-iso-inteligencia-artificial.png");
    expect(certificateImageFileName("  ")).toBe("certificado-nexti-academy.png");
  });

  it("abre o editor do LinkedIn com o texto, sem publicar", () => {
    const text = buildSuggestedPost("Curso & Escala");
    const url = new URL(linkedInComposerUrl(text));
    expect(url.hostname).toBe("www.linkedin.com");
    expect(url.searchParams.get("shareActive")).toBe("true");
    expect(url.searchParams.get("text")).toBe(text);
  });

  it("adicionar ao perfil usa o código real e o link de validação", () => {
    const url = new URL(linkedInAddToProfileUrl({ name: "Curso X", issuedAt: "2026-11-20T12:00:00Z", code: "ABC123" }));
    expect(url.searchParams.get("certId")).toBe("ABC123");
    expect(url.searchParams.get("certUrl")).toBe("https://journey-forge-achieve.lovable.app/validar-certificado/ABC123");
    expect(url.searchParams.get("issueYear")).toBe("2026");
    expect(url.searchParams.get("issueMonth")).toBe("11");
    expect(new URL(linkedInAddToProfileUrl({ name: "Curso X" })).searchParams.get("certUrl")).toBeNull();
  });
});
