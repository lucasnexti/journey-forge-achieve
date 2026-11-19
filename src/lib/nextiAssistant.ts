// Pure helpers for the "Assistente dos manuais" (no network, testable).

export const ASSISTANT_MODULES = [
  { id: "nexti", label: "Nexti" },
  { id: "talent", label: "Talent" },
  { id: "admissao", label: "Admissão" },
] as const;
export type AssistantModule = (typeof ASSISTANT_MODULES)[number]["id"];

/** Suggested first questions per module (each one is answered by the published manuals). */
export const MODULE_SUGGESTIONS: Record<AssistantModule, string[]> = {
  nexti: [
    "Como trato uma inconsistência de ponto?",
    "Como lanço uma cobertura de posto?",
    "Como libero o colaborador para cadastrar a biometria?",
  ],
  talent: [
    "Como crio uma requisição de vaga?",
    "Como incluo um candidato manualmente?",
    "Como crio uma avaliação?",
  ],
  admissao: [
    "Como crio e envio uma admissão?",
    "Como envio um kit de contrato com assinatura digital?",
    "Como configuro os documentos de cada etapa do fluxo?",
  ],
};

export const PROVIDER_LABEL: Record<string, string> = { wiki: "Wiki Nexti", octadesk: "Octadesk", manuais: "Manuais de implantação" };
export const NOT_FOUND =
  "Não encontrei uma orientação suficiente nos materiais disponíveis para responder com segurança. Você pode detalhar sua dúvida?";

export interface CandidateSource {
  n: number;
  page_id: string;
  title: string;
  section: string;
  url: string | null;
  updated_at: string | null;
  provider?: string | null;
  /** File shown inside the app when the material is opened (PDF/video); null = open the original page. */
  viewer_url?: string | null;
  orientation_path: string | null;
  orientation_title: string | null;
}

export interface CitedOrientation {
  path: string;
  title: string;
}

export interface CitedPage {
  page_id: string;
  title: string;
  url: string | null;
  provider: string | null;
  viewer_url: string | null;
  orientations: CitedOrientation[];
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
  const byId = new Map<string, CitedPage>();
  for (const c of candidates) {
    if (!nums.has(c.n)) continue;
    // The Wiki only supports answers and is never shown.
    if (isWiki(c)) continue;
    // Octadesk articles are never linked: only the Nexti na Prática guides made from them are shown.
    const linkable = !isOctadesk(c);
    let page = byId.get(c.page_id);
    if (!page) {
      page = {
        page_id: c.page_id, title: c.title, url: linkable ? c.url : null, provider: c.provider ?? null,
        viewer_url: linkable ? inAppViewer(c.viewer_url) : null, orientations: [],
      };
      byId.set(c.page_id, page);
      pages.push(page);
    }
    if (c.orientation_path && !page.orientations.some((o) => o.path === c.orientation_path)) {
      page.orientations.push({ path: c.orientation_path, title: c.orientation_title ?? c.title });
    }
  }
  const notFound = body.trim().startsWith(NOT_FOUND.slice(0, 40));
  const shown = pages.filter((p) => p.url || p.viewer_url || p.orientations.length > 0);
  return { body: body.trim(), pages: notFound ? [] : shown, notFound };
}

/** Octadesk material (by provider or by its link), which the assistant never points the user to. */
export function isOctadesk(c: Pick<CandidateSource, "provider" | "url" | "page_id">) {
  return c.provider === "octadesk" || c.page_id.startsWith("octadesk:") || /octadesk\.com/i.test(c.url ?? "");
}

/** Nexti Wiki material: supports answers but is never cited, linked or named to the user. */
export function isWiki(c: Pick<CandidateSource, "provider" | "url" | "page_id">) {
  return c.provider === "wiki" || c.page_id.startsWith("wiki:") || /wiki\.shared\.nexti\.com/i.test(c.url ?? "");
}

/** After two "not found" answers in a row, the user is pointed to the support channel. */
export function needsSupportHint(notFoundFlags: boolean[], index: number) {
  return index > 0 && notFoundFlags[index] === true && notFoundFlags[index - 1] === true;
}

// Only files from the manuals' own hosts are shown inside the app (Octadesk PDFs live on Google Drive).
const VIEWER_URL = /^https:\/\/(drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview|manuais-nexti\.pages\.dev\/arquivos\/[a-z0-9-]+(\.vertical)?\.(pdf|mp4))$/;

/** Returns the URL to show inside the app, or null when the material must open in a new tab. */
export function inAppViewer(url: string | null | undefined): string | null {
  return url && VIEWER_URL.test(url) ? url : null;
}

/** What the in-app viewer shows for a material. */
export interface OpenedManual {
  title: string;
  provider: string | null;
  viewer_url: string;
  /** Original page of the material (Octadesk article, manuals site). */
  url: string | null;
}
