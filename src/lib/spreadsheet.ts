import * as XLSX from "xlsx";

export const SPREADSHEET_ACCEPT = ".xlsx,.xls,.csv";
export const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024;

export interface Workbook { fileName: string; sheetNames: string[]; rows: (sheet: string) => unknown[][]; }

/** Lê XLSX, XLS e CSV (inclusive os relatórios do Teams, que vêm em UTF-16 com tabulação). */
export async function readSpreadsheet(file: File): Promise<Workbook> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) throw new Error("Formato não aceito. Envie um arquivo XLSX, XLS ou CSV.");
  if (file.size > MAX_SPREADSHEET_BYTES) throw new Error("Arquivo maior que 15 MB.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  if (ext === "csv") {
    const utf16 = (buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff);
    const text = new TextDecoder(utf16 ? (buf[0] === 0xff ? "utf-16le" : "utf-16be") : "utf-8").decode(buf).replace(/^\uFEFF/, "");
    wb = XLSX.read(text, { type: "string", cellDates: true, raw: false });
  } else {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  }
  if (!wb.SheetNames.length) throw new Error("O arquivo não tem abas com dados.");
  return {
    fileName: file.name,
    sheetNames: wb.SheetNames,
    rows: (sheet) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: "", blankrows: false }),
  };
}

export function downloadWorkbook(fileName: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = s.rows.length ? XLSX.utils.json_to_sheet(s.rows) : XLSX.utils.aoa_to_sheet([["Sem dados"]]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}

export function downloadListTemplate() {
  downloadWorkbook("modelo-lista-de-presenca.xlsx", [{ name: "Presença", rows: [
    { Nome: "Maria da Silva", "E-mail": "maria.silva@empresa.com.br", "Área": "Operações", Empresa: "Empresa Exemplo", Treinamento: "Onboarding Nexti", "Data do treinamento": "15/10/2026" },
  ] }]);
}
export function downloadBaseTemplate() {
  downloadWorkbook("modelo-base-de-colaboradores.xlsx", [{ name: "Colaboradores", rows: [
    { Identificador: "0001", Nome: "Maria da Silva", "E-mail": "maria.silva@empresa.com.br", "Área": "Operações", Empresa: "Empresa Exemplo", "Situação": "Ativo" },
  ] }]);
}
