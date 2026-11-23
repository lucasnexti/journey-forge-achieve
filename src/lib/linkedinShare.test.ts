import { describe, it, expect } from "vitest";
import { buildSuggestedPost, certificateVerifyUrl, linkedInComposerUrl, linkedInAddToProfileUrl } from "./linkedinShare";

describe("Compartilhamento no LinkedIn", () => {
  it("texto sugerido traz o nome do treinamento e as hashtags pedidas", () => {
    const t = buildSuggestedPost("Compliance Trabalhista");
    expect(t).toContain("Concluí o treinamento Compliance Trabalhista pela Nexti Academy");
    expect(t.startsWith("Mais uma conquista na minha jornada de desenvolvimento profissional! 🎓")).toBe(true);
    expect(t.endsWith("#DesenvolvimentoProfissional #AprendizadoContínuo #NextiAcademy")).toBe(true);
  });

  it("inclui o link do certificado só quando existe código válido", () => {
    expect(buildSuggestedPost("Curso X")).not.toContain("validar-certificado");
    const url = certificateVerifyUrl("ABC123");
    expect(url).toBe("https://journey-forge-achieve.lovable.app/validar-certificado/ABC123");
    expect(buildSuggestedPost("Curso X", url)).toContain(`Confira meu certificado: ${url}`);
    expect(certificateVerifyUrl("   ")).toBeNull();
    expect(certificateVerifyUrl(null)).toBeNull();
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
