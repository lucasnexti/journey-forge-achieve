// Pure helpers for the "Assistente dos manuais" (no network, testable).

export const ASSISTANT_MODULES = [
  { id: "nexti", label: "Nexti" },
  { id: "talent", label: "Talent" },
  { id: "admissao", label: "Admissão" },
] as const;
export type AssistantModule = (typeof ASSISTANT_MODULES)[number]["id"];

export const GREETING = "Olá! Qual é a sua dúvida? Vou consultar os materiais disponíveis para ajudar você.";
export const NOT_FOUND =
  "Não encontrei uma orientação suficiente nos materiais disponíveis para responder com segurança. Você pode detalhar sua dúvida?";

export interface CandidateSource {
  n: number;
  page_id: string;
  title: string;
  section: string;
  url: string | null;
  updated_at: string | null;
  orientation_path: string | null;
  orientation_title: string | null;
}

export interface CitedPage {
  page_id: string;
  title: string;
  url: string | null;
  orientation_path: string | null;
  orientation_title: string | null;
}

const FONTES_LINE = /(?:^|\n)[ \t]*\**FONTES?\**\s*:[^\n]*\s*$/i;
// While streaming, hide a trailing partial marker such as "\nFON".
const PARTIAL = /\n[ \t]*\**F(?:O(?:N(?:T(?:E(?:S)?)?)?)?)?\**$/i;

/** Splits the model text into the visible answer and the cited source numbers. */
export function parseAnswer(text: string, candidates: CandidateSource[], streaming = false) {
  const match = text.match(FONTES_LINE);
  let body = match ? text.slice(0, match.index).trimEnd() : text;
  if (!match && streaming) body = body.replace(PARTIAL, "");
  const nums = new Set<number>();
  if (match) {
    for (const m of match[0].matchAll(/\d+/g)) nums.add(Number(m[0]));
  }
  const pages: CitedPage[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!nums.has(c.n) || seen.has(c.page_id)) continue;
    seen.add(c.page_id);
    pages.push({ page_id: c.page_id, title: c.title, url: c.url, orientation_path: c.orientation_path, orientation_title: c.orientation_title });
  }
  const notFound = body.trim().startsWith(NOT_FOUND.slice(0, 40));
  return { body: body.trim(), pages: notFound ? [] : pages, notFound };
}

/** After two "not found" answers in a row, the user is pointed to the support channel. */
export function needsSupportHint(notFoundFlags: boolean[], index: number) {
  return index > 0 && notFoundFlags[index] === true && notFoundFlags[index - 1] === true;
}
