/** Endereço oficial do app — o mesmo usado no QR Code do certificado. */
export const OFFICIAL_ORIGIN = "https://journey-forge-achieve.lovable.app";

export const SHARE_INVITE = {
  title: "Parabéns por mais essa conquista! 🎓",
  body: "Você concluiu mais uma etapa da sua jornada de desenvolvimento profissional.",
  question: "Que tal compartilhar essa conquista com sua rede no LinkedIn?",
} as const;

/** Link público de validação do certificado (página que confirma se é válido). */
export function certificateVerifyUrl(code: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  if (!c) return null;
  return `${OFFICIAL_ORIGIN}/validar-certificado/${encodeURIComponent(c)}`;
}

/** Texto sugerido para a publicação; o colaborador pode editar antes de publicar. */
export function buildSuggestedPost(trainingName: string, verifyUrl?: string | null): string {
  const name = trainingName.trim() || "de capacitação";
  const parts = [
    "Mais uma conquista na minha jornada de desenvolvimento profissional! 🎓",
    `Concluí o treinamento ${name} pela Nexti Academy, ampliando meus conhecimentos e fortalecendo meu aprendizado.`,
    "Acredito que o desenvolvimento contínuo é essencial para evoluirmos profissionalmente e construirmos novas oportunidades.",
  ];
  if (verifyUrl) parts.push(`Confira meu certificado: ${verifyUrl}`);
  parts.push("#DesenvolvimentoProfissional #AprendizadoContínuo #NextiAcademy");
  return parts.join("\n\n");
}

/** Abre o editor de publicação do LinkedIn já com o texto; nada é publicado sem o colaborador confirmar. */
export function linkedInComposerUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

/** Formulário "Adicionar licença ou certificado" do perfil do LinkedIn. */
export function linkedInAddToProfileUrl(opts: { name: string; issuedAt?: string | null; code?: string | null }): string {
  const params = new URLSearchParams();
  params.set("startTask", "CERTIFICATION_NAME");
  params.set("name", opts.name);
  params.set("organizationName", "Nexti Academy");
  if (opts.issuedAt) {
    const d = new Date(opts.issuedAt);
    if (!Number.isNaN(d.getTime())) {
      params.set("issueYear", String(d.getFullYear()));
      params.set("issueMonth", String(d.getMonth() + 1));
    }
  }
  const url = certificateVerifyUrl(opts.code);
  if (url && opts.code) {
    params.set("certId", opts.code.trim());
    params.set("certUrl", url);
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
