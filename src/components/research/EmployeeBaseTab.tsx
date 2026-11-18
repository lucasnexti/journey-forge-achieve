import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SpreadsheetPicker, { type PickedSheet } from "./SpreadsheetPicker";
import { audienceLabel, BASE_FIELDS, diffBase, formatDateBR, formatDateTimeBR, isValidEmail, normalizeEmail, parseActive, todaySP, type Audience, type BaseField, type BaseRow } from "@/lib/research";
import { downloadBaseTemplate } from "@/lib/spreadsheet";

type Policy = "keep" | "inactivate" | "remove";
const POLICY: Record<Policy, string> = { keep: "Manter como estão", inactivate: "Marcar como inativas", remove: "Remover da nova versão" };

export default function EmployeeBaseTab({ audience, canImport }: { audience: Audience; canImport: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<PickedSheet<BaseField> | null>(null);
  const [company, setCompany] = useState(audience === "interno" ? "Nexti" : "");
  const [refDate, setRefDate] = useState(todaySP());
  const [policy, setPolicy] = useState<Policy | "">("");
  const [saving, setSaving] = useState(false);

  const bases = useQuery({
    queryKey: ["research-bases", audience],
    queryFn: async () => { const { data, error } = await supabase.from("research_employee_bases").select("*").eq("audience", audience).order("company_name").order("version", { ascending: false }); if (error) throw error; return data; },
  });
  const previous = useMemo(() => (bases.data ?? []).find((b) => b.company_name.trim().toLowerCase() === company.trim().toLowerCase()), [bases.data, company]);
  const prevRows = useQuery({
    queryKey: ["research-base-rows", previous?.id], enabled: open && step === 1 && !!previous,
    queryFn: async () => { const { data, error } = await supabase.from("research_employees").select("external_id,name,email,area,company,active").eq("base_id", previous!.id).limit(50000); if (error) throw error; return data; },
  });

  const parsed = useMemo(() => {
    if (!picked) return { rows: [] as BaseRow[], rejected: 0 };
    const cell = (r: unknown[], f: BaseField) => (picked.map[f] === null ? "" : r[picked.map[f] as number]);
    const rows: BaseRow[] = []; let rejected = 0;
    for (let i = picked.headerRow + 1; i < picked.data.length; i++) {
      const r = picked.data[i] ?? [];
      if (!r.some((c) => String(c ?? "").trim())) continue;
      const row: BaseRow = { external_id: String(cell(r, "external_id") ?? "").trim(), name: String(cell(r, "name") ?? "").trim(), email: normalizeEmail(cell(r, "email")), area: String(cell(r, "area") ?? "").trim(), company: String(cell(r, "company") ?? "").trim(), active: picked.map.status === null ? true : parseActive(cell(r, "status")) };
      if (!row.name || (!row.email && !row.external_id) || (row.email && !isValidEmail(row.email))) { rejected++; continue; }
      rows.push(row);
    }
    return { rows, rejected };
  }, [picked]);
  const diff = useMemo(() => diffBase((prevRows.data ?? []).map((r) => ({ external_id: r.external_id ?? "", name: r.name, email: r.email ?? "", area: r.area ?? "", company: r.company ?? "", active: r.active })), parsed.rows), [prevRows.data, parsed.rows]);
  const needsPolicy = !!previous && diff.absent.length > 0;

  const reset = () => { setOpen(false); setStep(0); setPicked(null); setPolicy(""); setRefDate(todaySP()); };
  const confirm = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("research_import_employee_base", { _p: {
        audience, company_name: company.trim(), reference_date: refDate, absent_policy: needsPolicy ? policy : "keep", source_file_name: picked?.fileName,
        client_summary: { added: diff.added.length, changed: diff.changed.length, unchanged: diff.unchanged, absent: diff.absent.length },
        rows: parsed.rows.map((r) => ({ ...r, email: r.email || null, external_id: r.external_id || null, active: r.active })),
      } });
      if (error) throw error;
      const r = data as { version: number; imported: number };
      toast.success(`Base atualizada: versão ${r.version} com ${r.imported} registros da planilha.`);
      reset(); bases.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a base."); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Cada importação cria uma nova versão; versões anteriores ficam preservadas para os indicadores históricos.</p>
        <div className="flex gap-2"><Button variant="outline" onClick={downloadBaseTemplate}><Download />Modelo de planilha</Button>{canImport && <Button onClick={() => setOpen(true)}><Upload />Importar base</Button>}</div>
      </div>
      {bases.isLoading ? <p role="status">Carregando…</p> : bases.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as bases.</p> : !bases.data?.length ? (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center"><Building2 className="h-10 w-10 text-primary" /><p className="font-semibold">Nenhuma base de colaboradores</p><p className="text-sm text-muted-foreground">Sem base, o alcance dos treinamentos aparece como "Base insuficiente para cálculo".</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm"><thead className="bg-muted text-left text-xs"><tr><th className="p-3">Empresa</th><th className="p-3">Versão</th><th className="p-3">Data de referência</th><th className="p-3">Ativos / total</th><th className="p-3">Alterações</th><th className="p-3">Importada em</th></tr></thead>
            <tbody>{bases.data.map((b, i, arr) => {
              const s = b.summary as Record<string, number>;
              const latest = i === 0 || arr[i - 1].company_name !== b.company_name;
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-3 font-medium">{b.company_name}</td>
                  <td className="p-3">v{b.version} {latest && <Badge className="ml-1">Atual</Badge>}</td>
                  <td className="p-3">{formatDateBR(b.reference_date)}</td>
                  <td className="p-3">{s.active ?? "—"} / {s.total ?? "—"}</td>
                  <td className="p-3 text-xs">+{s.added ?? 0} novos · {s.changed ?? 0} alterados · ausentes: {s.absent ?? 0} ({POLICY[b.absent_policy as Policy]})</td>
                  <td className="p-3 text-xs">{formatDateTimeBR(b.created_at)}</td>
                </tr>
              );
            })}</tbody></table>
        </div>
      )}
      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Importar base de colaboradores · {audienceLabel(audience)}</DialogTitle><DialogDescription>{step === 0 ? "Arquivo, aba e colunas" : "Revisar inclusões e alterações antes de atualizar"}</DialogDescription></DialogHeader>
          {step === 0 ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="base-company">Empresa da base *</Label><Input id="base-company" list="base-companies" value={company} onChange={(e) => setCompany(e.target.value)} /><datalist id="base-companies">{[...new Set((bases.data ?? []).map((b) => b.company_name))].map((c) => <option key={c} value={c} />)}</datalist></div>
                <div className="space-y-1"><Label htmlFor="base-ref">Data de referência *</Label><Input id="base-ref" type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} /></div>
              </div>
              <SpreadsheetPicker fields={BASE_FIELDS} required={["name"]} onChange={setPicked} />
              {picked && picked.map.email === null && picked.map.external_id === null && <p className="text-sm text-destructive">Associe a coluna de e-mail ou de identificador.</p>}
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={reset}>Cancelar</Button><Button disabled={!picked || !company.trim() || !refDate || (picked.map.email === null && picked.map.external_id === null)} onClick={() => setStep(1)}>Revisar</Button></div>
            </div>
          ) : (
            <div className="space-y-4">
              {previous ? <p className="text-sm">Comparando com a versão atual <strong>v{previous.version}</strong> de {formatDateBR(previous.reference_date)}.</p> : <p className="text-sm">Primeira base de <strong>{company}</strong>.</p>}
              {prevRows.isLoading ? <p role="status">Comparando…</p> : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[["Na planilha", parsed.rows.length], ["Inclusões", diff.added.length], ["Alterações", diff.changed.length], ["Sem mudança", diff.unchanged], ["Ausentes da planilha", diff.absent.length]].map(([l, v]) => <div key={l as string} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v}</p></div>)}
                </div>
              )}
              {parsed.rejected > 0 && <p className="text-sm text-destructive">{parsed.rejected} linhas sem nome, sem e-mail/identificador ou com e-mail inválido ficarão de fora.</p>}
              {diff.changed.length > 0 && <details className="rounded-md border border-border p-2 text-sm"><summary className="cursor-pointer font-medium">Ver alterações ({diff.changed.length})</summary><ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">{diff.changed.slice(0, 200).map((c, i) => <li key={i}>{c.after.name}: {c.before.area !== c.after.area && `área ${c.before.area || "—"} → ${c.after.area || "—"}; `}{c.before.active !== c.after.active && `situação ${c.before.active ? "ativo" : "inativo"} → ${c.after.active ? "ativo" : "inativo"}; `}{c.before.name !== c.after.name && `nome ${c.before.name} → ${c.after.name}`}</li>)}</ul></details>}
              {needsPolicy && (
                <fieldset className="space-y-2 rounded-lg border border-primary/40 p-3">
                  <legend className="px-1 text-sm font-semibold">{diff.absent.length} pessoas da versão atual não estão na nova planilha. O que fazer? *</legend>
                  {(Object.keys(POLICY) as Policy[]).map((p) => <label key={p} className="flex items-center gap-2 text-sm"><input type="radio" name="policy" checked={policy === p} onChange={() => setPolicy(p)} />{POLICY[p]}</label>)}
                  <p className="text-xs text-muted-foreground">Nada é inativado ou removido sem esta escolha.</p>
                </fieldset>
              )}
              <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button><Button disabled={saving || !parsed.rows.length || (needsPolicy && !policy) || prevRows.isLoading} onClick={confirm}>{saving ? "Atualizando…" : "Criar nova versão da base"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
