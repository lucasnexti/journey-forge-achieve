// Regras de Pesquisas e Indicadores usadas pela interface.
// Os cálculos oficiais e as validações finais acontecem no servidor; estas funções espelham as regras
// para prévias, revisões e exibição (e são cobertas por testes).

export type Audience = "interno" | "clientes";
export const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "interno", label: "Interno Nexti" },
  { value: "clientes", label: "Clientes" },
];
export const audienceLabel = (a: string) => AUDIENCES.find((x) => x.value === a)?.label ?? a;

export type ResearchPermission = "surveys_edit" | "lists_import" | "surveys_send" | "responses_identified" | "indicators_view" | "settings_manage";
export const PERMISSIONS: { value: ResearchPermission; label: string }[] = [
  { value: "surveys_edit", label: "Criar e editar pesquisas" },
  { value: "lists_import", label: "Importar listas de presença e bases de colaboradores" },
  { value: "surveys_send", label: "Enviar pesquisas e gerenciar prazos" },
  { value: "responses_identified", label: "Consultar respostas identificadas" },
  { value: "indicators_view", label: "Visualizar indicadores e exportar relatórios" },
  { value: "settings_manage", label: "Administrar configurações" },
];

export const SURVEY_STATUS: Record<string, string> = { draft: "Rascunho", active: "Em andamento", closed: "Encerrada" };
export const SEND_STATUS: Record<string, string> = {
  queued: "Na fila", sending: "Enviando", sent: "Enviado", delivered: "Entregue", failed: "Falha no envio", blocked_config: "Aguardando configuração",
};
export const JOB_KIND: Record<string, string> = { invite: "Convite", reminder: "Lembrete", extension_notice: "Aviso de prorrogação" };
export const JOB_STATUS: Record<string, string> = { ...SEND_STATUS, processing: "Processando", skipped: "Não enviado (dispensado)" };

/** Status exibido: uma pesquisa em andamento com prazo vencido já está encerrada, mesmo antes da rotina horária gravar isso. */
export function effectiveStatus(status: string, deadlineAt: string | null, now = new Date()): string {
  if (status === "active" && deadlineAt && new Date(deadlineAt) <= now) return "closed";
  return status;
}

// ---------- Indicadores ----------
export type NpsClass = "promoter" | "passive" | "detractor";
export function classifyNps(score: number): NpsClass {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}
/** NPS = % promotores − % detratores, em pontos de −100 a 100. null = sem dados. */
export function npsScore(promoters: number, detractors: number, total: number): number | null {
  if (!total) return null;
  return Math.round(((promoters - detractors) / total) * 100);
}
export function npsFromScores(scores: number[]): number | null {
  const p = scores.filter((s) => classifyNps(s) === "promoter").length;
  const d = scores.filter((s) => classifyNps(s) === "detractor").length;
  return npsScore(p, d, scores.length);
}
/** CSAT = respostas 4 ou 5 ÷ respostas válidas × 100. null = sem dados. */
export function csatPercent(satisfied: number, total: number): number | null {
  if (!total) return null;
  return Math.round((satisfied / total) * 1000) / 10;
}
export function csatFromScores(scores: number[]): number | null {
  return csatPercent(scores.filter((s) => s >= 4).length, scores.length);
}
/** Participação = convites respondidos ÷ convites únicos enviados com sucesso × 100. */
export function participationRate(respondedOfSent: number, sentOk: number): number | null {
  if (!sentOk) return null;
  return Math.round((respondedOfSent / sentOk) * 1000) / 10;
}
/** Alcance = pessoas ativas da base que participaram ÷ pessoas ativas da base × 100. */
export function reachPercent(participants: number, activeBase: number): number | null {
  if (!activeBase) return null;
  return Math.round((Math.min(participants, activeBase) / activeBase) * 1000) / 10;
}
export const showValue = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined || Number.isNaN(v) ? "Sem dados" : `${v.toLocaleString("pt-BR")}${suffix}`;

// ---------- E-mail e datas ----------
const EMAIL_RE = /^[A-Z0-9._%+'-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i;
export function isValidEmail(v: string | null | undefined): boolean {
  const e = (v ?? "").trim();
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e) && !e.includes("..");
}
export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");
/** Converte valores de planilha (Date, número serial do Excel, dd/mm/aaaa, aaaa-mm-dd, relatórios Teams/Meet) em aaaa-mm-dd. */
export function parseSheetDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  // Teams em inglês: "10/15/24, 2:03:11 PM" (mês/dia)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)/i);
  if (m) return valid(year(m[3]), +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return valid(year(m[3]), +m[2], +m[1]);
  return null;
  function year(y: string) { return y.length === 2 ? 2000 + +y : +y; }
  function valid(y: number, mo: number, d: number) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
}
const TZ = "America/Sao_Paulo";
export const formatDateBR = (iso: string | null | undefined) =>
  !iso ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.split("-").reverse().join("/")
    : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
export const formatDateTimeBR = (iso: string | null | undefined) =>
  !iso ? "—" : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
/** Data (aaaa-mm-dd) de hoje no fuso de São Paulo. */
export function todaySP(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p;
}
/** Último dia para responder quando o envio acontece hoje (fim do dia, horário de São Paulo). */
export function deadlineDate(days: number, now = new Date()): string {
  const [y, m, d] = todaySP(now).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// ---------- Importação de planilhas ----------
export type ListField = "name" | "last_name" | "email" | "area" | "company" | "training_name" | "training_date";
export const LIST_FIELDS: { value: ListField; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "last_name", label: "Sobrenome (opcional)" },
  { value: "email", label: "E-mail" },
  { value: "area", label: "Área" },
  { value: "company", label: "Empresa" },
  { value: "training_name", label: "Treinamento" },
  { value: "training_date", label: "Data do treinamento" },
];
export type BaseField = "external_id" | "name" | "email" | "area" | "company" | "status";
export const BASE_FIELDS: { value: BaseField; label: string }[] = [
  { value: "external_id", label: "Identificador" },
  { value: "name", label: "Nome" },
  { value: "email", label: "E-mail" },
  { value: "area", label: "Área" },
  { value: "company", label: "Empresa" },
  { value: "status", label: "Situação (ativo/inativo)" },
];

export const normalizeHeader = (h: unknown) =>
  String(h ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<string, string[]> = {
  name: ["nome", "nome completo", "name", "full name", "participante", "participant", "first name", "primeiro nome", "colaborador", "nome do colaborador"],
  last_name: ["sobrenome", "last name", "ultimo nome"],
  email: ["email", "e mail", "endereco de email", "endereco de e mail", "email address", "correio eletronico", "participant id upn", "id do participante upn", "upn"],
  area: ["area", "departamento", "department", "setor"],
  company: ["empresa", "company", "cliente", "organizacao", "organization"],
  training_name: ["treinamento", "training", "curso", "meeting title", "titulo da reuniao", "nome do treinamento", "evento"],
  training_date: ["data", "data do treinamento", "date", "training date", "first join", "primeira entrada", "time joined", "hora de entrada", "horario de entrada", "join time"],
  external_id: ["id", "identificador", "matricula", "codigo", "employee id", "cpf"],
  status: ["situacao", "status", "ativo", "situacao do colaborador"],
};

/** Sugere a associação entre colunas da planilha e campos do sistema. */
export function autoMapColumns<F extends string>(headers: unknown[], fields: readonly F[]): Record<F, number | null> {
  const norm = headers.map(normalizeHeader);
  const out = {} as Record<F, number | null>;
  const used = new Set<number>();
  for (const f of fields) {
    const aliases = ALIASES[f] ?? [];
    let idx = -1;
    for (const a of aliases) { idx = norm.findIndex((h, i) => !used.has(i) && h === a); if (idx >= 0) break; }
    if (idx < 0) for (const a of aliases) { idx = norm.findIndex((h, i) => !used.has(i) && a.length > 3 && h.startsWith(a)); if (idx >= 0) break; }
    out[f] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  // "E-mail" tem prioridade sobre o UPN do Teams
  return out;
}

/** Relatórios do Teams/Meet trazem um resumo antes da tabela: encontra a linha de cabeçalho real. */
export function detectHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const norm = (rows[i] ?? []).map(normalizeHeader);
    const hasName = norm.some((h) => ALIASES.name.includes(h));
    const hasEmail = norm.some((h) => ALIASES.email.includes(h));
    if (hasName && hasEmail) return i;
  }
  for (let i = 0; i < limit; i++) if ((rows[i] ?? []).filter((c) => String(c ?? "").trim()).length >= 2) return i;
  return 0;
}

export type RowIssue = "invalid_email" | "no_email" | "no_name" | "missing_training" | "duplicate";
export const ROW_ISSUE: Record<RowIssue, string> = {
  invalid_email: "E-mail inválido", no_email: "Sem e-mail", no_name: "Sem nome", missing_training: "Sem treinamento ou data", duplicate: "Repetido (consolidado)",
};
export interface ImportRow {
  line: number; name: string; email: string; area: string; company: string; training_name: string; training_date: string | null;
  issue: RowIssue | null; excluded: boolean;
}
export interface ListCommons { company: string; training_name: string; training_date: string | null; }

export function extractListRows(data: unknown[][], map: Record<ListField, number | null>, headerRow: number): ImportRow[] {
  const cell = (r: unknown[], f: ListField) => (map[f] === null || map[f] === undefined ? "" : r[map[f] as number]);
  const out: ImportRow[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const r = data[i] ?? [];
    if (!r.some((c) => String(c ?? "").trim())) continue;
    const first = String(cell(r, "name") ?? "").trim();
    const last = String(cell(r, "last_name") ?? "").trim();
    out.push({
      line: i + 1,
      name: [first, last].filter(Boolean).join(" "),
      email: normalizeEmail(cell(r, "email")),
      area: String(cell(r, "area") ?? "").trim(),
      company: String(cell(r, "company") ?? "").trim(),
      training_name: String(cell(r, "training_name") ?? "").trim(),
      training_date: parseSheetDate(cell(r, "training_date")),
      issue: null, excluded: false,
    });
  }
  return out;
}

/** Valida e consolida: a mesma pessoa na mesma sessão (treinamento + data) conta uma vez. */
export function validateListRows(rows: ImportRow[], commons: ListCommons, attendance: boolean): ImportRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const training = row.training_name || commons.training_name.trim();
    const date = row.training_date || commons.training_date;
    let issue: RowIssue | null = null;
    if (!row.email) issue = "no_email";
    else if (!isValidEmail(row.email)) issue = "invalid_email";
    else if (!row.name.trim()) issue = "no_name";
    else if (attendance && (!training || !date)) issue = "missing_training";
    if (!issue && !row.excluded) {
      const key = attendance ? `${row.email}|${training.toLowerCase()}|${date}` : row.email;
      if (seen.has(key)) issue = "duplicate"; else seen.add(key);
    }
    return { ...row, issue };
  });
}

export function summarizeRows(rows: ImportRow[]) {
  const s = { total: rows.length, valid: 0, invalid: 0, no_email: 0, duplicates: 0, excluded: 0 };
  for (const r of rows) {
    if (r.excluded) s.excluded++;
    else if (!r.issue) s.valid++;
    else if (r.issue === "duplicate") s.duplicates++;
    else if (r.issue === "no_email") s.no_email++;
    else s.invalid++;
  }
  return s;
}

// ---------- Base de colaboradores ----------
export interface BaseRow { external_id: string; name: string; email: string; area: string; company: string; active: boolean; }
export const parseActive = (v: unknown) => !/^(inativo|inativa|inactive|desligado|false|0|nao|não|n)$/i.test(String(v ?? "").trim());
const baseKey = (r: Pick<BaseRow, "email" | "external_id">) => (r.external_id ? `id:${r.external_id.trim().toLowerCase()}` : `em:${r.email}`);
/** Compara a nova planilha com a versão anterior. Ausentes NÃO são inativados aqui: depende da escolha do administrador. */
export function diffBase(previous: BaseRow[], next: BaseRow[]) {
  const prevBy = new Map<string, BaseRow>();
  for (const p of previous) { prevBy.set(baseKey(p), p); if (p.email) prevBy.set(`em:${p.email}`, p); }
  const matched = new Set<BaseRow>();
  const added: BaseRow[] = []; const changed: { before: BaseRow; after: BaseRow }[] = []; let unchanged = 0;
  for (const n of next) {
    const p = prevBy.get(baseKey(n)) ?? (n.email ? prevBy.get(`em:${n.email}`) : undefined);
    if (!p) { added.push(n); continue; }
    matched.add(p);
    if (p.name !== n.name || (p.area || "") !== (n.area || "") || p.active !== n.active || (p.email || "") !== (n.email || "")) changed.push({ before: p, after: n });
    else unchanged++;
  }
  const absent = previous.filter((p) => !matched.has(p));
  return { added, changed, unchanged, absent };
}

// ---------- Modelos de pesquisa ----------
export type QuestionType = "scale" | "single" | "multiple" | "text";
export interface QuestionDraft {
  id?: string; type: QuestionType; indicator: "nps" | "csat" | null; prompt: string; required: boolean;
  options: string[]; scale_min: number | null; scale_max: number | null; min_label: string; max_label: string;
  allow_comment?: boolean; scale_display?: "numeric" | "stars" | "satisfaction";
}
export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "scale", label: "Escala numérica" },
  { value: "single", label: "Escolha única" },
  { value: "multiple", label: "Múltipla escolha" },
  { value: "text", label: "Texto aberto" },
];
export const CSAT_LABELS = ["Muito insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito satisfeito"];

export function templateQuestions(kind: "nps" | "csat" | "custom"): QuestionDraft[] {
  if (kind === "nps") return [
    { type: "scale", indicator: "nps", prompt: "Em uma escala de 0 a 10, quanto você recomendaria este treinamento a um colega?", required: true, options: [], scale_min: 0, scale_max: 10, min_label: "Nada provável", max_label: "Extremamente provável" },
    { type: "text", indicator: null, prompt: "Qual é o principal motivo da sua nota?", required: false, options: [], scale_min: null, scale_max: null, min_label: "", max_label: "" },
  ];
  if (kind === "csat") return [
    { type: "scale", indicator: "csat", prompt: "Qual é o seu nível de satisfação com este treinamento?", required: true, options: [], scale_min: 1, scale_max: 5, min_label: "Muito insatisfeito", max_label: "Muito satisfeito" },
    { type: "text", indicator: null, prompt: "Deixe um comentário (opcional)", required: false, options: [], scale_min: null, scale_max: null, min_label: "", max_label: "" },
  ];
  return [{ type: "scale", indicator: null, prompt: "", required: true, options: [], scale_min: 1, scale_max: 5, min_label: "", max_label: "" }];
}

export function validateQuestion(q: QuestionDraft): string | null {
  if (!q.prompt.trim()) return "Escreva o enunciado da pergunta";
  if (q.prompt.length > 500) return "Enunciado muito longo";
  if (q.type === "scale") {
    if (q.scale_min === null || q.scale_max === null || q.scale_max <= q.scale_min) return "A escala precisa de mínimo menor que o máximo";
    if (q.scale_min < 0 || q.scale_max - q.scale_min > 10) return "A escala pode ter no máximo 11 pontos, a partir de 0";
    if (!Number.isInteger(q.scale_min) || !Number.isInteger(q.scale_max)) return "Use notas inteiras";
    if (q.scale_display && q.scale_display !== "numeric" && (q.scale_min !== 1 || q.scale_max !== 5)) return "Estrelas e satisfação usam escala de 1 a 5";
  }
  if ((q.type === "single" || q.type === "multiple")) {
    const opts = q.options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return "Inclua ao menos duas opções";
    if (opts.length > 20 || opts.some(o => o.length > 200)) return "Use até 20 alternativas com até 200 caracteres";
    if (new Set(opts).size !== opts.length) return "As opções não podem se repetir";
  }
  return null;
}

export const DEFAULT_EMAIL = {
  subject: "Sua opinião sobre {{pesquisa}}",
  body: "Olá, {{nome}}!\n\nQueremos saber como foi sua experiência. Responder leva poucos minutos.\n\nAcesse: {{link}}\n\nA pesquisa fica aberta até {{prazo}}.\n\nObrigado!",
};
export function fillEmail(text: string, vars: { nome: string; pesquisa: string; link: string; prazo: string }) {
  return text.replace(/\{\{\s*(nome|pesquisa|link|prazo)\s*\}\}/gi, (_, k: string) => vars[k.toLowerCase() as keyof typeof vars] ?? "");
}
