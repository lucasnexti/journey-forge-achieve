export interface ResearchEmailJob {
  kind: "invite" | "reminder" | "extension_notice";
  email: string;
  name: string;
  title: string;
  subject: string;
  body: string;
  deadline_at: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

export function formatDeadline(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(nome|pesquisa|link|prazo)\s*\}\}/gi, (_, k: string) => vars[k.toLowerCase()] ?? "");
}

export function renderResearchEmail(job: ResearchEmailJob, link: string | null) {
  const firstName = (job.name || "").trim().split(/\s+/)[0] || "";
  const prazo = formatDeadline(job.deadline_at);
  const vars = { nome: firstName, pesquisa: job.title, link: link ?? "(link de teste — sem resposta válida)", prazo };
  const prefix = job.kind === "reminder" ? "Lembrete: " : job.kind === "extension_notice" ? "Prazo prorrogado: " : "";
  const subject = prefix + fillTemplate(job.subject, vars);
  const intro = job.kind === "reminder"
    ? `Ainda não recebemos sua resposta. A pesquisa fica aberta até ${prazo}.`
    : job.kind === "extension_notice"
      ? `O prazo para responder foi prorrogado até ${prazo}.`
      : "";
  const bodyText = fillTemplate(job.body, vars);
  const html = [
    intro ? `<p>${esc(intro)}</p>` : "",
    ...bodyText.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`),
    link ? `<p><a href="${esc(link)}">Responder à pesquisa</a></p>` : "",
    `<p style="font-size:12px;color:#666">Confira no formulário se a pesquisa é anônima ou identificada antes de responder.</p>`,
  ].join("\n");
  return { subject, html, text: [intro, bodyText, link ?? ""].filter(Boolean).join("\n\n") };
}
