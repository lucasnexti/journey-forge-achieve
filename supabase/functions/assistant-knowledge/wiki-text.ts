// Pure helpers for the Wiki (Outline) source: markdown → sectioned passages, personal data removal. No imports (unit tested).

export interface Unprocessed { type: string; section: string; detail: string }
export interface Passage { section: string; content: string }

// Generic Nexti channels may stay; any other e-mail/phone/document number is hidden.
const KEEP_EMAILS = new Set(["suporte@nexti.com", "universidade@nexti.com", "rh@nexti.com"]);
const KEEP_PHONES = new Set(["4831121123"]);

export function redactPersonalData(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => (KEEP_EMAILS.has(m.toLowerCase()) ? m : "[e-mail oculto]"))
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ oculto]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b(?=\D|$)/g, (m) => (KEEP_PHONES.has(m) ? m : "[CPF oculto]"))
    .replace(/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, (m) => (KEEP_PHONES.has(m.replace(/\D/g, "").slice(-10)) ? m : "[telefone oculto]"));
}

/** Cleans Outline inline markdown to readable text (links keep their label, escapes removed). */
export function inlineText(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/@\[([^\]]+)\]\(mention:\/\/[^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~:])/g, "$1")
    .replace(/^\\$/, "")
    .replace(/==([^=]+)==/g, "$1")
    .trim();
}

/**
 * Converts one Wiki document (markdown) into passages tagged with their place in the Wiki:
 * "Coleção › Documento pai › Documento › Título › Subtítulo". Images/attachments/embeds are reported as unprocessed.
 */
export function wikiPassages(markdown: string, path: string[], max = 1800) {
  const unprocessed: Unprocessed[] = [];
  const headings: string[] = [];
  const base = path.filter(Boolean).join(" › ");
  const section = () => [base, ...headings.filter(Boolean)].filter(Boolean).join(" › ");
  const lines: { section: string; text: string }[] = [];
  let fence = false;
  for (const raw of (markdown ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) { if (line.trim()) lines.push({ section: section(), text: line }); continue; }
    if (/^\s*:::/.test(line)) continue; // Outline notice markers (:::info / :::)
    if (/^\s*\|?\s*:?-{3,}/.test(line) && /^[\s|:-]+$/.test(line)) continue; // table separators
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      headings.length = level - 1;
      headings[level - 1] = inlineText(h[2]);
      lines.push({ section: section(), text: `${h[1]} ${inlineText(h[2])}` });
      continue;
    }
    for (const img of line.matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)) {
      unprocessed.push({ type: "image", section: section(), detail: inlineText(img[1]) || "Imagem" });
    }
    const att = line.match(/^\s*\[([^\]]+)\]\(([^)]*\/api\/attachments\.redirect[^)]*)\)\s*$/);
    if (att) { unprocessed.push({ type: "file", section: section(), detail: att[1] }); continue; }
    let text = line.trim().startsWith("|")
      ? line.trim().replace(/^\||\|$/g, "").split("|").map((c) => inlineText(c)).filter(Boolean).join(" | ")
      : inlineText(line.replace(/^(\s*)[*+]\s+/, "$1- ").replace(/^(\s*)- \[( |x)\]\s+/i, (_m, sp, c) => `${sp}[${c.trim() ? "x" : " "}] `));
    if (!text) continue;
    if (/^\s*>/.test(line)) text = `> ${inlineText(line.replace(/^\s*>\s?/, ""))}`;
    lines.push({ section: section(), text: redactPersonalData(text) });
  }
  const passages: Passage[] = [];
  let cur: Passage | null = null;
  for (const l of lines) {
    if (!cur || cur.section !== l.section || cur.content.length + l.text.length + 1 > max) {
      if (cur) passages.push(cur);
      cur = { section: l.section.slice(0, 300), content: "" };
    }
    cur.content += (cur.content ? "\n" : "") + l.text.slice(0, max);
  }
  if (cur) passages.push(cur);
  return { passages: passages.filter((p) => p.content.replace(/^#+\s.*$/gm, "").trim()), unprocessed: unprocessed.slice(0, 50) };
}

/** Wiki module for a collection name (Talent / Admissão collections answer only those modules). */
export function moduleForCollection(name: string): "talent" | "admissao" | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\btalent\b/.test(n)) return "talent";
  if (/\badmissao\b/.test(n)) return "admissao";
  return null;
}
