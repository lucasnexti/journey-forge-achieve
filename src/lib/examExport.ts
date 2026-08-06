export interface ExamAttemptExportRow {
  nome?: string;
  attempt_number: number;
  correct_count: number;
  total_questions: number;
  percent: number;
  passing_score?: number;
  duration_seconds: number;
  passed: boolean;
  created_at: string;
}

const fmtTime = (s: number) => `${Math.floor((s || 0) / 60)}m ${(s || 0) % 60}s`;
const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR");
const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

const HEADERS = ["Aluno", "Tentativa", "Acertos", "Nota (%)", "Nota mínima (%)", "Tempo", "Situação", "Data"];

const toRow = (a: ExamAttemptExportRow) => [
  a.nome || "Aluno",
  `#${a.attempt_number}`,
  `${a.correct_count}/${a.total_questions}`,
  String(a.percent),
  a.passing_score != null ? String(a.passing_score) : "-",
  fmtTime(a.duration_seconds),
  a.passed ? "Aprovado" : "Reprovado",
  fmtDate(a.created_at),
];

export function exportAttemptsCsv(attempts: ExamAttemptExportRow[], trackTitle: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [HEADERS, ...attempts.map(toRow)].map((r) => r.map(esc).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `avaliacoes-${slug(trackTitle)}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportAttemptsPdf(attempts: ExamAttemptExportRow[], trackTitle: string) {
  const approved = attempts.filter((a) => a.passed).length;
  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + Number(a.percent), 0) / attempts.length)
    : 0;

  const rows = attempts
    .map(
      (a) =>
        `<tr>${toRow(a)
          .map((c, i) => `<td class="${i === 6 ? (a.passed ? "ok" : "bad") : ""}">${c}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Histórico de Avaliações — ${trackTitle}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', Inter, system-ui, sans-serif; color: #1c1c1e; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; }
  .bar { height: 4px; background: #FF6B00; border-radius: 2px; margin-bottom: 14px; }
  .stats { display: flex; gap: 24px; font-size: 12px; margin-bottom: 14px; }
  .stats b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tr { page-break-inside: avoid; }
  .ok { color: #15803d; font-weight: 600; }
  .bad { color: #b91c1c; font-weight: 600; }
</style></head><body>
<div class="bar"></div>
<h1>Histórico de Avaliações</h1>
<div class="sub">${trackTitle} &middot; gerado em ${new Date().toLocaleString("pt-BR")}</div>
<div class="stats">
  <div>Tentativas <b>${attempts.length}</b></div>
  <div>Aprovados <b>${approved}</b></div>
  <div>Reprovados <b>${attempts.length - approved}</b></div>
  <div>Média <b>${avg}%</b></div>
</div>
<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
