import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import SpreadsheetPicker, { type PickedSheet } from "./SpreadsheetPicker";
import {
  audienceLabel, extractListRows, formatDateBR, LIST_FIELDS, ROW_ISSUE, summarizeRows, validateListRows,
  type Audience, type ImportRow, type ListField,
} from "@/lib/research";
import { downloadListTemplate } from "@/lib/spreadsheet";

interface Props { audience: Audience; open: boolean; onClose: () => void; onImported: (listId: string) => void; defaultPurpose?: "attendance" | "recipients"; }
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const STEPS = ["Arquivo e colunas", "Informações da lista", "Revisão", "Confirmação"];

export default function ImportListWizard({ audience, open, onClose, onImported, defaultPurpose = "attendance" }: Props) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<PickedSheet<ListField> | null>(null);
  const [purpose, setPurpose] = useState<"attendance" | "recipients">(defaultPurpose);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [training, setTraining] = useState("");
  const [date, setDate] = useState("");
  const [className, setClassName] = useState("");
  const [trackId, setTrackId] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [saving, setSaving] = useState(false);

  const options = useQuery({
    queryKey: ["research-filter-options", audience], enabled: open,
    queryFn: async () => { const { data, error } = await supabase.rpc("research_filter_options", { _audience: audience }); if (error) throw error; return data as { trainings: string[]; companies: string[] }; },
  });
  const tracks = useQuery({
    queryKey: ["research-tracks"], enabled: open,
    queryFn: async () => { const { data, error } = await supabase.from("tracks").select("id,title").order("title"); if (error) throw error; return data; },
  });

  const attendance = purpose === "attendance";
  const commons = { company, training_name: training, training_date: date || null };
  const validated = useMemo(() => validateListRows(rows, commons, attendance), [rows, company, training, date, attendance]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = summarizeRows(validated);
  const hasCompanyCol = picked?.map.company !== null && picked?.map.company !== undefined;
  const hasTrainingCol = picked?.map.training_name !== null && picked?.map.training_name !== undefined;
  const hasDateCol = picked?.map.training_date !== null && picked?.map.training_date !== undefined;

  const reset = () => { setStep(0); setPicked(null); setRows([]); setName(""); setCompany(""); setTraining(""); setDate(""); setClassName(""); setTrackId(""); };
  const close = () => { reset(); onClose(); };

  const toContext = () => {
    if (!picked) return;
    setRows(extractListRows(picked.data, picked.map, picked.headerRow));
    if (!name) setName(picked.fileName.replace(/\.(xlsx|xls|csv)$/i, ""));
    setStep(1);
  };
  const contextError = !name.trim() ? "Informe um nome para a lista"
    : attendance && !hasTrainingCol && !training.trim() ? "Informe o treinamento (a planilha não tem essa coluna)"
    : attendance && !hasDateCol && !date ? "Informe a data do treinamento (a planilha não tem essa coluna)"
    : null;

  const update = (line: number, patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => (r.line === line ? { ...r, ...patch } : r)));

  const confirm = async () => {
    setSaving(true);
    try {
      const valid = validated.filter((r) => !r.excluded && !r.issue);
      const { data, error } = await supabase.rpc("research_import_list", {
        _p: {
          audience, purpose, name: name.trim(), company_name: company.trim() || null, training_name: training.trim() || null,
          training_date: date || null, class_name: className.trim() || null, track_id: trackId || null,
          source_file_name: picked?.fileName, source_sheet: picked?.sheet,
          client_summary: { total: summary.total, valid: summary.valid, invalid: summary.invalid, no_email: summary.no_email, duplicates: summary.duplicates, excluded: summary.excluded },
          rows: valid.map((r) => ({ name: r.name, email: r.email, area: r.area || null, company: r.company || null, training_name: r.training_name || null, training_date: r.training_date })),
        },
      });
      if (error) throw error;
      const res = data as { list_id: string; members: number; attendance_new: number; attendance_existing: number };
      toast.success(`Lista importada: ${res.members} participantes${attendance ? ` · ${res.attendance_new} presenças novas, ${res.attendance_existing} já registradas` : ""}.`);
      onImported(res.list_id);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar a lista.");
    } finally { setSaving(false); }
  };

  const visible = (onlyIssues ? validated.filter((r) => r.issue || r.excluded) : validated).slice(0, 300);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lista · {audienceLabel(audience)}</DialogTitle>
          <DialogDescription>Passo {step + 1} de 4 — {STEPS[step]}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-wrap gap-2 text-xs">{STEPS.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{i + 1}. {s}</li>)}</ol>

        {step === 0 && (
          <div className="space-y-4">
            <div className="flex justify-end"><Button variant="outline" size="sm" onClick={downloadListTemplate}>Baixar modelo de planilha</Button></div>
            <SpreadsheetPicker fields={LIST_FIELDS} required={["name", "email"]} onChange={setPicked} />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancelar</Button><Button disabled={!picked} onClick={toContext}>Continuar</Button></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Finalidade da lista</legend>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="purpose" checked={attendance} onChange={() => setPurpose("attendance")} className="mt-1" /><span><strong>Presença em treinamento</strong> — fica registrada como presença e conta no alcance. Exige treinamento e data.</span></label>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="purpose" checked={!attendance} onChange={() => setPurpose("recipients")} className="mt-1" /><span><strong>Somente destinatários</strong> — para pesquisa avulsa; não é tratada como presença.</span></label>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="list-name">Nome da lista *</Label><Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></div>
              <div className="space-y-1">
                <Label htmlFor="list-company">Empresa {hasCompanyCol ? "(usada quando a linha não tiver empresa)" : "(para toda a lista)"}</Label>
                <Input id="list-company" list="company-options" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={audience === "interno" ? "Nexti" : "Selecione ou digite"} />
                <datalist id="company-options">{(options.data?.companies ?? []).map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1">
                <Label htmlFor="list-training">Treinamento {attendance && !hasTrainingCol && "*"}</Label>
                <Input id="list-training" list="training-options" value={training} onChange={(e) => setTraining(e.target.value)} />
                <datalist id="training-options">{(options.data?.trainings ?? []).map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1"><Label htmlFor="list-date">Data do treinamento {attendance && !hasDateCol && "*"}</Label><Input id="list-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="list-class">Turma</Label><Input id="list-class" value={className} onChange={(e) => setClassName(e.target.value)} /></div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="list-track">Curso da universidade (opcional)</Label>
                <select id="list-track" className={selectCls} value={trackId} onChange={(e) => setTrackId(e.target.value)}>
                  <option value="">Nenhum</option>{(tracks.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Valores informados aqui valem para as linhas em que a planilha não traz a informação.</p>
            {contextError && <p className="text-sm text-destructive">{contextError}</p>}
            <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button><Button disabled={!!contextError} onClick={() => setStep(2)}>Revisar registros</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <SummaryCards s={summary} />
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyIssues} onCheckedChange={(v) => setOnlyIssues(!!v)} />Mostrar somente registros com problema ou excluídos</label>
            <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left text-xs"><tr><th className="px-2 py-2">Linha</th><th className="px-2">Nome</th><th className="px-2">E-mail</th><th className="px-2">Empresa / Área</th>{attendance && <th className="px-2">Sessão</th>}<th className="px-2">Situação</th><th className="px-2">Excluir</th></tr></thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.line} className={`border-t border-border ${r.excluded ? "opacity-50" : ""}`}>
                      <td className="px-2 py-1 text-xs text-muted-foreground">{r.line}</td>
                      <td className="px-2 py-1"><Input aria-label={`Nome da linha ${r.line}`} className="h-8 min-w-36" value={r.name} onChange={(e) => update(r.line, { name: e.target.value })} /></td>
                      <td className="px-2 py-1"><Input aria-label={`E-mail da linha ${r.line}`} className="h-8 min-w-48" value={r.email} onChange={(e) => update(r.line, { email: e.target.value.trim().toLowerCase() })} /></td>
                      <td className="px-2 py-1 text-xs">{r.company || company || "—"}{r.area && ` · ${r.area}`}</td>
                      {attendance && <td className="px-2 py-1 text-xs">{r.training_name || training || "—"} · {formatDateBR(r.training_date || date || null)}</td>}
                      <td className="px-2 py-1">{r.excluded ? <Badge variant="outline">Excluído</Badge> : r.issue ? <Badge variant={r.issue === "duplicate" ? "secondary" : "destructive"}>{ROW_ISSUE[r.issue]}</Badge> : <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Válido</Badge>}</td>
                      <td className="px-2 py-1 text-center"><Checkbox aria-label={`Excluir linha ${r.line}`} checked={r.excluded} onCheckedChange={(v) => update(r.line, { excluded: !!v })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validated.length > 300 && <p className="text-xs text-muted-foreground">Mostrando 300 de {validated.length} registros. Use o filtro para ver os registros com problema.</p>}
            <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button><Button disabled={summary.valid === 0} onClick={() => setStep(3)}>Continuar</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <SummaryCards s={summary} />
            <ul className="space-y-1 text-sm">
              <li><strong>Lista:</strong> {name} · {attendance ? "Presença em treinamento" : "Somente destinatários"} · {audienceLabel(audience)}</li>
              {company && <li><strong>Empresa padrão:</strong> {company}</li>}
              {training && <li><strong>Treinamento:</strong> {training}{date && ` · ${formatDateBR(date)}`}</li>}
              {className && <li><strong>Turma:</strong> {className}</li>}
            </ul>
            <p className="text-sm text-muted-foreground">Serão importados {summary.valid} registros válidos. Registros inválidos, sem e-mail, repetidos ou excluídos ficam de fora.{attendance && " Presenças já registradas para a mesma pessoa na mesma sessão não serão duplicadas."}</p>
            <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button><Button disabled={saving} onClick={confirm}>{saving ? "Importando…" : "Confirmar importação"}</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCards({ s }: { s: ReturnType<typeof summarizeRows> }) {
  const items = [["Válidos", s.valid], ["Inválidos", s.invalid], ["Sem e-mail", s.no_email], ["Repetidos", s.duplicates], ["Excluídos", s.excluded]] as const;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{items.map(([l, v]) => <div key={l} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v}</p></div>)}</div>;
}
