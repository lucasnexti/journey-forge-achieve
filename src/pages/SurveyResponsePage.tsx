import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, Link2Off, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SurveyForm, { type FormQuestion, type FormValue } from "@/components/research/SurveyForm";
import { formatDateTimeBR, formatDateBR } from "@/lib/research";
import { packSurveyAnswers } from "@/lib/surveyBuilder";

type State = "loading" | "open" | "invalid" | "closed" | "answered" | "submitted" | "error";
interface Form { title: string; description: string; deadline_at: string; questions: FormQuestion[]; presentation: string; anonymous: boolean; thank_you: string; training_name?: string; training_date?: string }

/** Resposta sem login, pelo link individual do convite. */
export default function SurveyResponsePage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>("loading");
  const [form, setForm] = useState<Form | null>(null);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [comments, setComments] = useState<Record<string,string>>({});
  const [thanks, setThanks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = "Pesquisa · Universidade Nexti";
    (async () => {
      const { data, error } = await supabase.rpc("research_get_form", { _token: token });
      if (error || !data) { setState("error"); return; }
      const d = data as unknown as { state: State; title?: string } & Partial<Form>;
      setTitle(d.title ?? "");
      if (d.state === "open" && d.title && d.deadline_at) setForm({ title: d.title, description: d.description ?? "", deadline_at: d.deadline_at, questions: d.questions ?? [], presentation:d.presentation ?? "", anonymous:!!d.anonymous, thank_you:d.thank_you ?? "Obrigado pela participação!", training_name:d.training_name, training_date:d.training_date });
      setState(d.state);
    })();
  }, [token]);

  const submit = async () => {
    if (!form) return;
    const errs: Record<string, string> = {};
    for (const q of form.questions) {
      const v = values[q.id];
      const empty = v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
      if (q.required && empty) errs[q.id] = "Resposta obrigatória";
    }
    setErrors(errs);
    if (Object.keys(errs).length) { setMessage("Responda às perguntas obrigatórias."); return; }
    setSending(true); setMessage(null);
    const answers = packSurveyAnswers(values,comments);
    const { data, error } = await supabase.rpc("research_submit_response", { _token: token, _answers: answers as import("@/integrations/supabase/types").Json });
    setSending(false);
    if (error) { setMessage("Não foi possível enviar agora. Tente novamente."); return; }
    const r = data as { state: State; message?: string; question_id?: string; thank_you?: string };
    if (r.state === "error") { setMessage(r.message ?? "Revise suas respostas."); if (r.question_id) setErrors({ [r.question_id]: r.message ?? "Revise" }); return; }
    setThanks(r.thank_you ?? form.thank_you); setState(r.state);
  };

  return (
    <main className="min-h-screen min-h-dvh bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-nexti shadow-md shadow-primary/20"><span className="font-display text-sm font-extrabold text-primary-foreground">N</span></div>
          <span className="font-display text-sm font-bold">Universidade <span className="text-gradient-nexti">Nexti</span></span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
          {state === "loading" && <p role="status">Carregando pesquisa…</p>}
          {state === "invalid" && <Status icon={Link2Off} title="Link inválido" text="Este link de pesquisa não é válido. Confira se ele foi copiado por completo a partir do e-mail." />}
          {state === "error" && <Status icon={Link2Off} title="Não foi possível abrir a pesquisa" text="Tente novamente em alguns instantes." />}
          {state === "closed" && <Status icon={Clock} title="Pesquisa encerrada" text={`${title ? `"${title}" ` : "Esta pesquisa "}não está mais recebendo respostas.`} />}
          {state === "answered" && <Status icon={CheckCircle2} title="Convite já respondido" text="Recebemos uma resposta para este convite. Cada convite aceita uma única resposta." />}
          {state === "submitted" && <Status icon={CheckCircle2} title="Resposta enviada. Obrigado!" text={thanks} />}
          {state === "open" && form && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">{form.title}</h1>
                {form.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{form.description}</p>}
                {form.training_name && <p className="mt-2 text-sm">{form.training_name}{form.training_date && ` · ${formatDateBR(form.training_date)}`}</p>}
                {form.presentation && <p className="mt-3 whitespace-pre-wrap text-sm">{form.presentation}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Aberta até {formatDateTimeBR(form.deadline_at)} (horário de Brasília)</p>
              </div>
              <p className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />{form.anonymous ? "Esta pesquisa é anônima: as respostas não ficam vinculadas ao seu convite. Não inclua nome, e-mail ou dados pessoais nos comentários." : "Esta pesquisa é identificada: suas respostas poderão ser consultadas pelos administradores autorizados."}</p>
              <SurveyForm questions={form.questions} values={values} comments={comments} onComment={(id,v)=>setComments(x=>({...x,[id]:v}))} errors={errors} onChange={(id, v) => { setValues((x) => ({ ...x, [id]: v })); setErrors((e) => { const n = { ...e }; delete n[id]; return n; }); }} />
              {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
              <Button size="lg" className="w-full sm:w-auto" disabled={sending} onClick={submit}>{sending ? "Enviando…" : "Enviar respostas"}</Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
function Status({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <div className="flex flex-col items-center gap-3 py-8 text-center"><Icon className="h-12 w-12 text-primary" /><h1 className="font-display text-xl font-bold">{title}</h1><p className="max-w-md text-sm text-muted-foreground">{text}</p></div>;
}
