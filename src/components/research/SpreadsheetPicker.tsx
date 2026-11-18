import { useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { autoMapColumns, detectHeaderRow } from "@/lib/research";
import { readSpreadsheet, SPREADSHEET_ACCEPT, type Workbook } from "@/lib/spreadsheet";

export interface PickedSheet<F extends string> {
  fileName: string; sheet: string; data: unknown[][]; headerRow: number; map: Record<F, number | null>;
}

interface Props<F extends string> {
  fields: readonly { value: F; label: string }[];
  required: F[];
  onChange: (picked: PickedSheet<F> | null) => void;
}

const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Passos 1 a 3 da importação: arquivo, aba, prévia e associação de colunas. */
export default function SpreadsheetPicker<F extends string>({ fields, required, onChange }: Props<F>) {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<Record<F, number | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const data = useMemo(() => (wb && sheet ? wb.rows(sheet) : []), [wb, sheet]);
  const headers = (data[headerRow] ?? []).map((h, i) => String(h ?? "").trim() || `Coluna ${i + 1}`);

  const emit = (d: unknown[][], s: string, h: number, m: Record<F, number | null> | null, w = wb) => {
    const ok = !!w && !!m && required.every((f) => m[f] !== null && m[f] !== undefined);
    onChange(ok ? { fileName: w!.fileName, sheet: s, data: d, headerRow: h, map: m! } : null);
  };
  const selectSheet = (w: Workbook, s: string) => {
    const d = w.rows(s);
    const h = detectHeaderRow(d);
    const m = autoMapColumns(d[h] ?? [], fields.map((f) => f.value));
    setSheet(s); setHeaderRow(h); setMap(m); emit(d, s, h, m, w);
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setLoading(true);
    try {
      const w = await readSpreadsheet(file);
      setWb(w); selectSheet(w, w.sheetNames[0]);
    } catch (e) {
      setWb(null); setMap(null); onChange(null);
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/60">
        <Upload className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium">{wb ? wb.fileName : "Selecionar arquivo XLSX, XLS ou CSV"}</span>
        <span className="text-xs text-muted-foreground">Também aceita relatórios de presença exportados do Teams e do Google Meet.</span>
        <input type="file" accept={SPREADSHEET_ACCEPT} className="sr-only" aria-label="Arquivo da planilha" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {loading && <p role="status" className="text-sm text-muted-foreground">Lendo arquivo…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {wb && map && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sheet">Aba do arquivo</Label>
              <select id="sheet" className={selectCls} value={sheet} onChange={(e) => selectSheet(wb, e.target.value)}>
                {wb.sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="header-row">Linha do cabeçalho</Label>
              <select id="header-row" className={selectCls} value={headerRow} onChange={(e) => {
                const h = Number(e.target.value); const m = autoMapColumns(data[h] ?? [], fields.map((f) => f.value));
                setHeaderRow(h); setMap(m); emit(data, sheet, h, m);
              }}>
                {data.slice(0, 40).map((r, i) => <option key={i} value={i}>Linha {i + 1}: {(r as unknown[]).slice(0, 3).map(String).join(" · ").slice(0, 60)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FileSpreadsheet className="h-4 w-4 text-primary" />Prévia ({Math.max(data.length - headerRow - 1, 0)} linhas)</p>
            <div className="max-h-48 overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr>{headers.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{data.slice(headerRow + 1, headerRow + 6).map((r, i) => <tr key={i} className="border-t border-border">{headers.map((_, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{fmt((r as unknown[])[j])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Associe as colunas da planilha aos campos do sistema</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <div key={f.value} className="space-y-1">
                  <Label htmlFor={`map-${f.value}`}>{f.label}{required.includes(f.value) && " *"}</Label>
                  <select id={`map-${f.value}`} className={selectCls} value={map[f.value] ?? ""} onChange={(e) => {
                    const m = { ...map, [f.value]: e.target.value === "" ? null : Number(e.target.value) } as Record<F, number | null>;
                    setMap(m); emit(data, sheet, headerRow, m);
                  }}>
                    <option value="">— Não usar / informar na tela —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {required.some((f) => map[f] === null) && <p className="mt-2 text-xs text-destructive">Associe os campos obrigatórios (*) para continuar.</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setWb(null); setMap(null); onChange(null); }}>Trocar arquivo</Button>
        </>
      )}
    </div>
  );
}
function fmt(v: unknown) { return v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v ?? ""); }
