import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CSAT_LABELS } from "@/lib/research";

export interface FormQuestion {
  id: string; type: "scale" | "single" | "multiple" | "text"; indicator: "nps" | "csat" | null; prompt: string; required: boolean;
  options: string[]; scale_min: number | null; scale_max: number | null; min_label: string | null; max_label: string | null;
}
export type FormValue = number | string | string[] | undefined;

interface Props { questions: FormQuestion[]; values: Record<string, FormValue>; onChange: (id: string, v: FormValue) => void; errors?: Record<string, string>; preview?: boolean; }

/** Formulário de resposta (usado na página pública e na prévia do administrador). */
export default function SurveyForm({ questions, values, onChange, errors = {}, preview }: Props) {
  return (
    <div className="space-y-6">
      {questions.map((q, idx) => {
        const v = values[q.id];
        const err = errors[q.id];
        return (
          <fieldset key={q.id} className="space-y-3" aria-invalid={!!err}>
            <legend className="text-base font-semibold text-foreground">
              {idx + 1}. {q.prompt || <span className="italic text-muted-foreground">(pergunta sem enunciado)</span>}
              {q.required ? <span className="text-primary"> *</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}
            </legend>
            {q.type === "scale" && q.scale_min !== null && q.scale_max !== null && (
              <div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={q.prompt}>
                  {Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min! + i).map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={v === n} disabled={preview}
                      title={q.indicator === "csat" ? CSAT_LABELS[n - 1] : undefined}
                      onClick={() => onChange(q.id, n)}
                      className={cn("h-11 min-w-11 flex-1 rounded-lg border text-sm font-semibold transition-colors sm:flex-none",
                        v === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60")}>
                      {n}
                    </button>
                  ))}
                </div>
                {(q.min_label || q.max_label) && <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{q.min_label}</span><span>{q.max_label}</span></div>}
              </div>
            )}
            {q.type === "single" && (
              <div className="space-y-2" role="radiogroup" aria-label={q.prompt}>
                {q.options.map((o) => (
                  <label key={o} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm", v === o ? "border-primary bg-primary/5" : "border-border")}>
                    <input type="radio" name={q.id} checked={v === o} disabled={preview} onChange={() => onChange(q.id, o)} className="accent-[hsl(var(--primary))]" />{o}
                  </label>
                ))}
              </div>
            )}
            {q.type === "multiple" && (
              <div className="space-y-2">
                {q.options.map((o) => {
                  const arr = Array.isArray(v) ? v : [];
                  const checked = arr.includes(o);
                  return (
                    <label key={o} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm", checked ? "border-primary bg-primary/5" : "border-border")}>
                      <Checkbox checked={checked} disabled={preview} onCheckedChange={(c) => onChange(q.id, c ? [...arr, o] : arr.filter((x) => x !== o))} />{o}
                    </label>
                  );
                })}
              </div>
            )}
            {q.type === "text" && (
              <Textarea aria-label={q.prompt} value={typeof v === "string" ? v : ""} disabled={preview} maxLength={2000} rows={4} onChange={(e) => onChange(q.id, e.target.value)} />
            )}
            {err && <p className="text-sm text-destructive">{err}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}
