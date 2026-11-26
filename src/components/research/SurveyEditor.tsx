import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, Eye, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import SurveyForm, { type FormQuestion, type FormValue } from "./SurveyForm";
import SurveyDatePicker from "./SurveyDatePicker";
import { surveyMetadataSchema } from "@/lib/surveyBuilder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  audienceLabel, DEFAULT_EMAIL, deadlineDate, fillEmail, formatDateBR, QUESTION_TYPES, templateQuestions, validateQuestion,
  type Audience, type QuestionDraft, type QuestionType,
} from "@/lib/research";

export type SurveyKind = "nps" | "csat" | "custom";
interface Props { open: boolean; audience: Audience; surveyId: string | null; kind: SurveyKind; onClose: () => void; onSaved: (id: string) => void; onNewVersion?: (id: string) => void; }
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const KIND_LABEL: Record<SurveyKind, string> = { nps: "NPS", csat: "CSAT", custom: "Personalizada" };

export default function SurveyEditor({ open, audience, surveyId, kind: initialKind, onClose, onSaved, onNewVersion }: Props) {
  const [kind, setKind] = useState<SurveyKind>(initialKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trackId, setTrackId] = useState("");
  const [training, setTraining] = useState("");
  const [className, setClassName] = useState("");
  const [reason, setReason] = useState("");
  const [subject, setSubject] = useState(DEFAULT_EMAIL.subject);
  const [body, setBody] = useState(DEFAULT_EMAIL.body);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [reminderOn, setReminderOn] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [questions, setQuestions] = useState<QuestionDraft[]>(templateQuestions(initialKind));
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [presentation, setPresentation] = useState("");
  const [thankYou, setThankYou] = useState("Sua participação ajuda a melhorar nossos treinamentos.");
  const [trainingDate, setTrainingDate] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [tab, setTab] = useState("dados");
  const [previewValues, setPreviewValues] = useState<Record<string,FormValue>>({});
  const [previewComments, setPreviewComments] = useState<Record<string,string>>({});
  const locked = !!sentAt || !!publishedAt;

  const tracks = useQuery({ queryKey: ["research-tracks"], enabled: open, queryFn: async () => { const { data, error } = await supabase.from("tracks").select("id,title").order("title"); if (error) throw error; return data; } });
  const settings = useQuery({ queryKey: ["research-settings"], enabled: open, queryFn: async () => { const { data, error } = await supabase.from("research_settings").select("*"); if (error) throw error; return data; } });

  useEffect(() => {
    if (!open) { setLoaded(false); return; }
    if (!surveyId) {
      setPublishedAt(null); setPresentation(""); setThankYou("Sua participação ajuda a melhorar nossos treinamentos."); setTrainingDate(""); setAnonymous(false); setTab("dados"); setPreviewValues({}); setPreviewComments({});
      setKind(initialKind); setTitle(""); setDescription(""); setTrackId(""); setTraining(""); setClassName(""); setReason("");
      setSubject(DEFAULT_EMAIL.subject); setBody(DEFAULT_EMAIL.body); setDeadlineDays(7);
      setReminderOn(true); setReminderDays(3); setQuestions(templateQuestions(initialKind)); setSentAt(null); setLoaded(true);
      return;
    }
    (async () => {
      const [{ data: s, error }, { data: qs, error: qe }] = await Promise.all([
        supabase.from("research_surveys").select("*").eq("id", surveyId).single(),
        supabase.from("research_questions").select("*").eq("survey_id", surveyId).order("position"),
      ]);
      if (error || qe || !s) { toast.error("Não foi possível abrir a pesquisa."); onClose(); return; }
      setPublishedAt(s.published_at); setPresentation(s.presentation); setThankYou(s.thank_you); setTrainingDate(s.training_date ?? ""); setAnonymous(s.anonymous);
      setKind(s.kind as SurveyKind); setTitle(s.title); setDescription(s.description); setTrackId(s.track_id ?? ""); setTraining(s.training_name ?? "");
      setClassName(s.class_name ?? ""); setReason(s.standalone_reason ?? ""); setSubject(s.email_subject); setBody(s.email_body);
      setDeadlineDays(s.deadline_days); setReminderOn(s.reminder_enabled); setReminderDays(s.reminder_after_days); setSentAt(s.first_sent_at);
      setQuestions((qs ?? []).map((q) => ({ id: q.id, type: q.type as QuestionType, indicator: (q.indicator as "nps" | "csat" | null) ?? null, prompt: q.prompt, required: q.required, options: (q.options as string[]) ?? [], scale_min: q.scale_min, scale_max: q.scale_max, min_label: q.min_label ?? "", max_label: q.max_label ?? "", allow_comment: q.allow_comment, scale_display: q.scale_display as "numeric" | "stars" | "satisfaction" })));
      setLoaded(true);
    })();
  }, [open, surveyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pesquisa nova: aplica o prazo e o lembrete padrão do público quando as configurações chegam
  useEffect(() => {
    const st = settings.data?.find((x) => x.audience === audience);
    if (open && !surveyId && st) { setDeadlineDays(st.default_deadline_days); setReminderDays(st.default_reminder_days); }
  }, [settings.data, open, surveyId, audience]);

  const standalone = !trackId && !training.trim() && !className.trim();
  const problems: string[] = [];
  if (!title.trim()) problems.push("Informe o título");
  if (standalone && !reason.trim()) problems.push("Pesquisa avulsa: informe o motivo");
  if (!questions.length) problems.push("Adicione ao menos uma pergunta");
  questions.forEach((q, i) => { const e = validateQuestion(q); if (e) problems.push(`Pergunta ${i + 1}: ${e}`); });
  if (kind === "nps" && !questions.some((q) => q.indicator === "nps")) problems.push("A pesquisa NPS precisa da pergunta de recomendação (0 a 10)");
  if (kind === "csat" && !questions.some((q) => q.indicator === "csat")) problems.push("A pesquisa CSAT precisa da pergunta de satisfação (1 a 5)");
  if (reminderOn && reminderDays >= deadlineDays) problems.push("O lembrete precisa acontecer antes do fim do prazo");

  const patchQ = (i: number, p: Partial<QuestionDraft>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const move = (i: number, d: -1 | 1) => setQuestions((qs) => { const n = [...qs]; const j = i + d; if (j < 0 || j >= n.length) return qs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addQ = (type: QuestionType) => setQuestions((qs) => [...qs, { type, indicator: null, prompt: "", required: true, options: type === "single" || type === "multiple" ? ["", ""] : [], scale_min: type === "scale" ? 1 : null, scale_max: type === "scale" ? 5 : null, min_label: "", max_label: "" }]);

  const save = async (publish = false) => {
    if (locked) return;
    const metadata = surveyMetadataSchema.safeParse({ title, presentation, thank_you: thankYou, anonymous, training_date: trainingDate || null });
    if (!metadata.success) { toast.error(metadata.error.issues[0]?.message ?? "Revise os dados"); return; }
    if (problems.length) { toast.error(problems[0]); return; }
    setSaving(true);
    try {
      const row = { ...metadata.data, audience, kind, description: description.trim(), track_id: trackId || null, training_name: training.trim() || null,
        class_name: className.trim() || null, standalone_reason: reason.trim() || null, email_subject: subject.trim(), email_body: body,
        reminder_enabled: reminderOn, reminder_after_days: reminderDays, deadline_days: deadlineDays };
      const qs = questions.map(q => ({ ...q, prompt:q.prompt.trim(), options:q.type === "single" || q.type === "multiple" ? q.options.map(o=>o.trim()).filter(Boolean) : [],
        scale_min:q.type === "scale" ? q.scale_min : null, scale_max:q.type === "scale" ? q.scale_max : null,
        allow_comment:!!q.allow_comment, scale_display:q.type === "scale" ? q.scale_display ?? "numeric" : "numeric" }));
      const { data, error } = await supabase.rpc("research_save_builder", { _id: surveyId, _data: row, _questions: qs, _publish: publish });
      if (error) throw error;
      if (typeof data !== "string") throw new Error("Não foi possível salvar.");
      toast.success(publish ? "Pesquisa publicada. Nenhum e-mail foi disparado." : "Rascunho salvo."); onSaved(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  const previewQuestions: FormQuestion[] = questions.map((q, i) => ({ id: q.id ?? `q${i}`, type: q.type, indicator: q.indicator, prompt: q.prompt, required: q.required, options: q.options.filter((o) => o.trim()), scale_min: q.scale_min, scale_max: q.scale_max, min_label: q.min_label, max_label: q.max_label, allow_comment:q.allow_comment, scale_display:q.scale_display }));
  const sender = settings.data?.find((s) => s.audience === audience);
  const prazo = formatDateBR(deadlineDate(deadlineDays));
  const vars = { nome: "Maria", pesquisa: title || "Título da pesquisa", link: "https://…/pesquisa/<link individual>", prazo };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{surveyId ? "Editar pesquisa" : "Nova pesquisa"} · {KIND_LABEL[kind]} · {audienceLabel(audience)}</DialogTitle>
          <DialogDescription>Salve como rascunho e envie quando estiver pronta.</DialogDescription>
        </DialogHeader>
        {!loaded ? <p role="status">Carregando…</p> : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap"><TabsTrigger value="dados">Dados</TabsTrigger><TabsTrigger value="perguntas">Perguntas ({questions.length})</TabsTrigger><TabsTrigger value="email">E-mail e prazo</TabsTrigger><TabsTrigger value="previa">Prévia</TabsTrigger></TabsList>

            <TabsContent value="dados" className="space-y-3 pt-3">
              <div className="space-y-1"><Label htmlFor="sv-title">Título *</Label><Input id="sv-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="sv-desc">Descrição</Label><Textarea id="sv-desc" value={description} maxLength={2000} rows={3} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label htmlFor="sv-track">Curso</Label><select id="sv-track" className={selectCls} value={trackId} onChange={(e) => setTrackId(e.target.value)}><option value="">Nenhum</option>{(tracks.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
                <div className="space-y-1"><Label htmlFor="sv-training">Treinamento</Label><Input id="sv-training" value={training} maxLength={200} onChange={(e) => setTraining(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="sv-class">Turma</Label><Input id="sv-class" value={className} maxLength={200} onChange={(e) => setClassName(e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label htmlFor="sv-presentation">Mensagem de apresentação</Label><Textarea id="sv-presentation" value={presentation} disabled={locked} maxLength={2000} onChange={e=>setPresentation(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Data de realização</Label><SurveyDatePicker value={trainingDate} onChange={setTrainingDate} disabled={locked} /></div><div className="space-y-1"><Label htmlFor="sv-identity">Identificação da pesquisa</Label><Select value={anonymous ? "anonymous" : "identified"} onValueChange={v=>setAnonymous(v==="anonymous")} disabled={locked}><SelectTrigger id="sv-identity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="identified">Identificada</SelectItem><SelectItem value="anonymous">Anônima</SelectItem></SelectContent></Select></div></div>
              <div className="space-y-1"><Label htmlFor="sv-thanks">Mensagem de agradecimento após responder</Label><Textarea id="sv-thanks" disabled={locked} value={thankYou} maxLength={1000} onChange={e=>setThankYou(e.target.value)} /></div>
              {anonymous && <p className="text-sm text-muted-foreground">Respostas sem vínculo com o convite. Não solicite nome, e-mail ou outros dados pessoais nas perguntas.</p>}
              {standalone && <div className="space-y-1"><Label htmlFor="sv-reason">Motivo da pesquisa avulsa *</Label><Textarea id="sv-reason" value={reason} maxLength={1000} rows={2} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: pesquisa de clima após mudança de processo" /></div>}
            </TabsContent>

            <TabsContent value="perguntas" className="space-y-3 pt-3">
              {locked && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Perguntas e escalas preservadas após o primeiro envio.</span>
                  {onNewVersion && surveyId && <Button size="sm" variant="outline" onClick={() => onNewVersion(surveyId)}>Criar nova versão</Button>}
                </div>
              )}
              {questions.map((q, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{i + 1}</Badge>
                    {q.indicator ? <Badge>{q.indicator === "nps" ? "NPS 0–10" : "CSAT 1–5"}</Badge> : (
                      <select aria-label={`Tipo da pergunta ${i + 1}`} disabled={locked} className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={q.type}
                        onChange={(e) => { const t = e.target.value as QuestionType; patchQ(i, { type: t, scale_display:"numeric", options: t === "single" || t === "multiple" ? (q.options.length >= 2 ? q.options : ["", ""]) : [], scale_min: t === "scale" ? 1 : null, scale_max: t === "scale" ? 5 : null }); }}>
                        {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    )}
                    <label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={q.required} disabled={locked} onCheckedChange={(v) => patchQ(i, { required: v })} />Obrigatória</label>
                    <Button variant="ghost" size="icon" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label="Mover para cima"><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" disabled={locked || i === questions.length - 1} onClick={() => move(i, 1)} aria-label="Mover para baixo"><ArrowDown /></Button>
                    <Button variant="ghost" size="icon" disabled={locked} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} aria-label="Remover pergunta"><Trash2 /></Button>
                  </div>
                  <Input aria-label={`Enunciado da pergunta ${i + 1}`} placeholder="Enunciado da pergunta" value={q.prompt} disabled={locked} maxLength={500} onChange={(e) => patchQ(i, { prompt: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm"><Switch checked={!!q.allow_comment} disabled={locked} onCheckedChange={v=>patchQ(i,{allow_comment:v})} />Permitir comentário adicional?</label>
                  {q.type === "scale" && <div className="space-y-1"><Label>Formato da avaliação</Label><Select disabled={locked} value={q.scale_display ?? "numeric"} onValueChange={v=>patchQ(i,{scale_display:v as "numeric" | "stars" | "satisfaction", ...(v !== "numeric" ? {scale_min:1,scale_max:5} : {})})}><SelectTrigger aria-label={`Formato da escala ${i+1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="numeric">Escala numérica</SelectItem>{q.indicator !== "nps" && <><SelectItem value="stars">1 a 5 estrelas</SelectItem><SelectItem value="satisfaction">Escala de satisfação</SelectItem></>}</SelectContent></Select></div>}
                  {q.type === "scale" && (
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Input aria-label="Mínimo" type="number" disabled={locked || !!q.indicator || (q.scale_display && q.scale_display!=="numeric")} value={q.scale_min ?? ""} onChange={(e) => patchQ(i, { scale_min: Number(e.target.value) })} />
                      <Input aria-label="Máximo" type="number" disabled={locked || !!q.indicator || (q.scale_display && q.scale_display!=="numeric")} value={q.scale_max ?? ""} onChange={(e) => patchQ(i, { scale_max: Number(e.target.value) })} />
                      <Input aria-label="Rótulo do mínimo" placeholder="Rótulo do mínimo" disabled={locked} maxLength={60} value={q.min_label} onChange={(e) => patchQ(i, { min_label: e.target.value })} />
                      <Input aria-label="Rótulo do máximo" placeholder="Rótulo do máximo" disabled={locked} maxLength={60} value={q.max_label} onChange={(e) => patchQ(i, { max_label: e.target.value })} />
                    </div>
                  )}
                  {(q.type === "single" || q.type === "multiple") && (
                    <div className="space-y-2">
                      {q.options.map((o, k) => (
                        <div key={k} className="flex gap-2">
                          <Input aria-label={`Opção ${k + 1}`} placeholder={`Opção ${k + 1}`} disabled={locked} value={o} maxLength={200} onChange={(e) => patchQ(i, { options: q.options.map((x, z) => (z === k ? e.target.value : x)) })} />
                          <Button variant="ghost" size="icon" disabled={locked || q.options.length <= 2} onClick={() => patchQ(i, { options: q.options.filter((_, z) => z !== k) })} aria-label="Remover opção"><Trash2 /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" disabled={locked || q.options.length >= 20} onClick={() => patchQ(i, { options: [...q.options, ""] })}><Plus />Opção</Button>
                    </div>
                  )}
                  <div className="border-t border-border pt-3"><p className="mb-3 text-xs font-semibold text-muted-foreground">Prévia do participante</p><SurveyForm questions={[previewQuestions[i]]} values={previewValues} comments={previewComments} onChange={(id,v)=>setPreviewValues(x=>({...x,[id]:v}))} onComment={(id,v)=>setPreviewComments(x=>({...x,[id]:v}))} /></div>
                  {validateQuestion(q) && !locked && <p className="text-xs text-destructive">{validateQuestion(q)}</p>}
                </div>
              ))}
              {!locked && <div className="flex flex-wrap gap-2">{QUESTION_TYPES.map((t) => <Button key={t.value} variant="outline" size="sm" onClick={() => addQ(t.value)}><Plus />{t.label}</Button>)}</div>}
            </TabsContent>

            <TabsContent value="email" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">Remetente deste público: <strong>{sender ? `${sender.sender_name} <${sender.sender_email}>` : "—"}</strong>. Use {"{{nome}}"}, {"{{pesquisa}}"}, {"{{link}}"} e {"{{prazo}}"} no texto.</p>
              <div className="space-y-1"><Label htmlFor="sv-subject">Assunto *</Label><Input id="sv-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="sv-body">Mensagem *</Label><Textarea id="sv-body" value={body} maxLength={5000} rows={8} onChange={(e) => setBody(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label htmlFor="sv-deadline">Prazo de resposta (dias após o envio)</Label><Input id="sv-deadline" type="number" min={1} max={90} disabled={locked} value={deadlineDays} onChange={(e) => setDeadlineDays(Number(e.target.value))} /></div>
                <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={reminderOn} onCheckedChange={setReminderOn} />Enviar lembrete</label>
                <div className="space-y-1"><Label htmlFor="sv-reminder">Lembrete após (dias)</Label><Input id="sv-reminder" type="number" min={1} max={60} disabled={!reminderOn} value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value))} /></div>
              </div>
              <p className="text-xs text-muted-foreground">O lembrete vai somente para quem ainda não respondeu. {locked ? "O prazo de uma pesquisa enviada muda pela ação Prorrogar." : `Se enviada hoje, o prazo termina em ${prazo} (horário de Brasília).`}</p>
            </TabsContent>

            <TabsContent value="previa" className="grid gap-4 pt-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convite por e-mail</p>
                <p className="text-xs text-muted-foreground">De: {sender ? `${sender.sender_name} <${sender.sender_email}>` : "—"}</p>
                <p className="mb-3 font-semibold">{fillEmail(subject, vars)}</p>
                <div className="whitespace-pre-wrap text-sm">{fillEmail(body, vars)}</div>
                <p className="mt-3 text-xs text-muted-foreground">{anonymous ? "Esta pesquisa é anônima. Não inclua dados pessoais em textos livres." : "Esta pesquisa é identificada: suas respostas poderão ser consultadas pelos administradores autorizados."}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formulário</p>
                <h3 className="font-display text-lg font-bold">{title || "Título da pesquisa"}</h3>
                {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
                {presentation && <p className="mb-4 whitespace-pre-wrap text-sm">{presentation}</p>}
                <SurveyForm questions={previewQuestions} values={previewValues} comments={previewComments} onChange={(id,v)=>setPreviewValues(x=>({...x,[id]:v}))} onComment={(id,v)=>setPreviewComments(x=>({...x,[id]:v}))} />
                <Button variant="ghost" className="mt-3" onClick={()=>{setPreviewValues({});setPreviewComments({});}}>Limpar respostas da prévia</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
        {problems.length > 0 && loaded && <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive">{problems.slice(0, 4).map((p) => <li key={p}>{p}</li>)}</ul>}
        <div className="flex flex-wrap justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>Fechar</Button><Button variant="outline" onClick={()=>setTab("previa")}><Eye />Visualizar</Button>{!locked && <><Button variant="outline" disabled={saving || !loaded} onClick={()=>save(false)}>Salvar rascunho</Button><Button disabled={saving || !loaded} onClick={()=>save(true)}><Send />{saving ? "Salvando…" : "Publicar pesquisa"}</Button></>}{locked && onNewVersion && surveyId && <Button onClick={()=>onNewVersion(surveyId)}>Criar nova versão</Button>}</div>
      </DialogContent>
    </Dialog>
  );
}
