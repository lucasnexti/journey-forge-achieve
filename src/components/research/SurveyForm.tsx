import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CSAT_LABELS } from "@/lib/research";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

export interface FormQuestion {
  id: string; type: "scale" | "single" | "multiple" | "text"; indicator: "nps" | "csat" | null; prompt: string; required: boolean;
  options: string[]; scale_min: number | null; scale_max: number | null; min_label: string | null; max_label: string | null;
  allow_comment?: boolean; scale_display?: string;
}
export type FormValue = number | string | string[] | undefined;

interface Props { questions: FormQuestion[]; values: Record<string, FormValue>; onChange: (id: string, v: FormValue) => void; errors?: Record<string, string>; preview?: boolean; comments?: Record<string,string>; onComment?: (id:string,v:string)=>void; }

/** Formulário de resposta (usado na página pública e na prévia do administrador). */
export default function SurveyForm({ questions, values, onChange, errors = {}, preview, comments = {}, onComment }: Props) {
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
                  {Array.from({ length: Math.max(0, Math.min(11, q.scale_max - q.scale_min + 1)) }, (_, i) => (q.scale_min ?? 0) + i).map((n) => (
                    <Button variant="outline" key={n} type="button" role="radio" aria-label={q.scale_display === "stars" ? `${n} estrela${n>1 ? "s" : ""}` : q.scale_display === "satisfaction" ? CSAT_LABELS[n-1] : String(n)} aria-checked={v === n} disabled={preview}
                      title={q.indicator === "csat" ? CSAT_LABELS[n - 1] : undefined}
                      onClick={() => onChange(q.id, n)}
                      className={cn("h-11 min-w-11 flex-1 rounded-lg border text-sm font-semibold transition-colors sm:flex-none", q.scale_display === "satisfaction" && "h-auto min-h-11 whitespace-normal",
                        v === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60")}>
                      {q.scale_display === "stars" ? <><Star className={cn("h-5 w-5",typeof v==="number" && v>=n && (v===n ? "fill-primary-foreground text-primary-foreground" : "fill-primary text-primary"))} /><span>{n}</span></> : q.scale_display === "satisfaction" ? CSAT_LABELS[n-1] : n}
                    </Button>
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
            {q.allow_comment && <div className="space-y-2"><label htmlFor={`comment-${q.id}`} className="text-sm text-muted-foreground">Gostaria de deixar algum comentário ou sugestão? <span>(opcional)</span></label><Textarea id={`comment-${q.id}`} value={comments[q.id] ?? ""} maxLength={2000} rows={2} disabled={preview} onChange={e=>onComment?.(q.id,e.target.value)} /></div>}
            {err && <p className="text-sm text-destructive">{err}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}
