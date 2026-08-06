import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, X, ClipboardCheck, Pencil, CheckCircle2, XCircle, Download, FileText,
} from "lucide-react";
import { exportAttemptsCsv, exportAttemptsPdf } from "@/lib/examExport";


type QType = "multiple_choice" | "true_false" | "essay";

interface ExamRow {
  id: string;
  track_id: string;
  title: string;
  description: string | null;
  passing_score: number;
  question_count: number;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_active: boolean;
}

interface QuestionRow {
  id: string;
  exam_id: string;
  type: QType;
  question: string;
  options: string[];
  correct_answer: number | null;
  expected_answer: string | null;
  explanation: string | null;
  order_index: number;
  is_active: boolean;
}

const emptyQuestion = {
  id: "" as string,
  type: "multiple_choice" as QType,
  question: "",
  options: ["", "", "", ""],
  correct_answer: 0,
  expected_answer: "",
  explanation: "",
  is_active: true,
};

const AdminProvas = () => {
  const [params, setParams] = useSearchParams();
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);
  const [trackId, setTrackId] = useState<string>(params.get("track") || "");
  const [exam, setExam] = useState<ExamRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyQuestion);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.from("tracks").select("id, title").eq("is_active", true).order("order_index")
      .then(({ data }) => setTracks(data || []));
  }, []);

  const load = useCallback(async (tid: string) => {
    if (!tid) { setExam(null); setQuestions([]); setAttempts([]); return; }
    setLoading(true);
    const { data: examData } = await supabase.from("exams").select("*").eq("track_id", tid).maybeSingle();
    setExam(examData as ExamRow | null);
    if (examData) {
      const [{ data: qs }, { data: ats }] = await Promise.all([
        supabase.from("exam_questions").select("*").eq("exam_id", examData.id).order("order_index"),
        supabase.from("exam_attempts")
          .select("id, user_id, percent, correct_count, total_questions, passed, duration_seconds, attempt_number, created_at")
          .eq("exam_id", examData.id).order("created_at", { ascending: false }).limit(200),
      ]);
      setQuestions((qs || []) as unknown as QuestionRow[]);
      const userIds = [...new Set((ats || []).map((a) => a.user_id))];
      let names: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", userIds);
        names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.nome]));
      }
      setAttempts((ats || []).map((a) => ({ ...a, nome: names[a.user_id] || "Aluno" })));
    } else {
      setQuestions([]); setAttempts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(trackId); }, [trackId, load]);

  const selectTrack = (v: string) => { setTrackId(v); setParams({ track: v }); setShowForm(false); };

  const createExam = async () => {
    const { error } = await supabase.from("exams").insert({ track_id: trackId });
    if (error) toast.error(error.message);
    else { toast.success("Avaliação criada!"); load(trackId); }
  };

  const saveExam = async (patch: Partial<ExamRow>) => {
    if (!exam) return;
    const next = { ...exam, ...patch };
    setExam(next);
    const { error } = await supabase.from("exams").update(patch).eq("id", exam.id);
    if (error) toast.error(error.message);
  };

  const deleteExam = async () => {
    if (!exam || !confirm("Excluir a avaliação e todas as questões deste curso?")) return;
    await supabase.from("exams").delete().eq("id", exam.id);
    toast.success("Avaliação excluída.");
    load(trackId);
  };

  const openNew = () => { setForm(emptyQuestion); setShowForm(true); };
  const openEdit = (q: QuestionRow) => {
    setForm({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.type === "essay" ? ["", ""] : (q.options?.length ? q.options : ["", ""]),
      correct_answer: q.correct_answer ?? 0,
      expected_answer: q.expected_answer || "",
      explanation: q.explanation || "",
      is_active: q.is_active,
    });
    setShowForm(true);
  };

  const setType = (t: QType) => {
    setForm((f) => ({
      ...f,
      type: t,
      options: t === "true_false" ? ["Verdadeiro", "Falso"] : t === "essay" ? [] : ["", "", "", ""],
      correct_answer: 0,
    }));
  };

  const saveQuestion = async () => {
    if (!exam) return;
    if (!form.question.trim()) { toast.error("Informe o enunciado."); return; }
    let options: string[] = [];
    if (form.type === "true_false") options = ["Verdadeiro", "Falso"];
    else if (form.type === "multiple_choice") {
      options = form.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) { toast.error("Cadastre ao menos 2 alternativas."); return; }
      if (form.correct_answer >= options.length) { toast.error("Marque a alternativa correta."); return; }
    }
    if (form.type === "essay" && !form.expected_answer.trim()) {
      toast.error("Informe o gabarito/resposta esperada."); return;
    }

    const payload = {
      exam_id: exam.id,
      type: form.type,
      question: form.question.trim(),
      options,
      correct_answer: form.type === "essay" ? null : form.correct_answer,
      expected_answer: form.type === "essay" ? form.expected_answer.trim() : null,
      explanation: form.explanation.trim() || null,
      is_active: form.is_active,
    };

    const { error } = form.id
      ? await supabase.from("exam_questions").update(payload).eq("id", form.id)
      : await supabase.from("exam_questions").insert({ ...payload, order_index: questions.length + 1 });

    if (error) toast.error(error.message);
    else { toast.success(form.id ? "Questão atualizada!" : "Questão adicionada!"); setShowForm(false); load(trackId); }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Excluir esta questão?")) return;
    await supabase.from("exam_questions").delete().eq("id", id);
    toast.success("Questão removida.");
    load(trackId);
  };

  const toggleQuestion = async (q: QuestionRow) => {
    await supabase.from("exam_questions").update({ is_active: !q.is_active }).eq("id", q.id);
    load(trackId);
  };

  const typeLabel: Record<QType, string> = {
    multiple_choice: "Múltipla escolha",
    true_false: "Verdadeiro ou Falso",
    essay: "Dissertativa",
  };

  const activeCount = questions.filter((q) => q.is_active).length;

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Avaliação (Provas Finais)</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-3 text-sm text-muted-foreground">
            Configure a prova final obrigatória de cada curso, o banco de questões e acompanhe os resultados.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Label className="text-xs">Curso / Trilha</Label>
          <Select value={trackId} onValueChange={selectTrack}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um curso" /></SelectTrigger>
            <SelectContent>
              {tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!trackId ? (
        <div className="mt-8 card-surface p-12 text-center text-sm text-muted-foreground">
          Selecione um curso para configurar sua avaliação.
        </div>
      ) : loading ? (
        <div className="mt-8 card-surface p-12 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !exam ? (
        <div className="mt-8 card-surface p-12 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Este curso ainda não possui avaliação final.</p>
          <Button onClick={createExam} className="mt-4 gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar Avaliação
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="config" className="mt-6">
          <TabsList>
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="questoes">Banco de Questões ({questions.length})</TabsTrigger>
            <TabsTrigger value="resultados">Resultados ({attempts.length})</TabsTrigger>
          </TabsList>

          {/* ── Configuração ── */}
          <TabsContent value="config" className="mt-4">
            <div className="card-surface p-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título da prova</Label>
                  <Input value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })}
                    onBlur={(e) => saveExam({ title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nota mínima de aprovação (%)</Label>
                  <Input type="number" min={1} max={100} value={exam.passing_score}
                    onChange={(e) => setExam({ ...exam, passing_score: Number(e.target.value) })}
                    onBlur={(e) => saveExam({ passing_score: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de questões sorteadas</Label>
                  <Input type="number" min={1} value={exam.question_count}
                    onChange={(e) => setExam({ ...exam, question_count: Number(e.target.value) })}
                    onBlur={(e) => saveExam({ question_count: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">
                    Banco atual: {activeCount} questões ativas.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tempo limite (minutos) — opcional</Label>
                  <Input type="number" min={0} value={exam.time_limit_minutes ?? ""}
                    onChange={(e) => setExam({ ...exam, time_limit_minutes: e.target.value ? Number(e.target.value) : null })}
                    onBlur={(e) => saveExam({ time_limit_minutes: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([
                  ["is_active", "Prova ativa"],
                  ["shuffle_questions", "Embaralhar questões"],
                  ["shuffle_options", "Embaralhar alternativas"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                    <span className="text-sm text-foreground">{label}</span>
                    <Switch checked={exam[key]} onCheckedChange={(v) => saveExam({ [key]: v } as Partial<ExamRow>)} />
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={deleteExam} className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir avaliação
              </Button>
            </div>
          </TabsContent>

          {/* ── Questões ── */}
          <TabsContent value="questoes" className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Questões exclusivas deste curso. Cada tentativa sorteia {exam.question_count}.
              </p>
              <Button size="sm" onClick={showForm ? () => setShowForm(false) : openNew} className="gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90">
                {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showForm ? "Cancelar" : "Nova Questão"}
              </Button>
            </div>

            {showForm && (
              <div className="mt-4 card-surface p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setType(v as QType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                        <SelectItem value="true_false">Verdadeiro ou Falso</SelectItem>
                        <SelectItem value="essay">Dissertativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                      <span className="text-sm text-muted-foreground">Questão ativa</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Enunciado *</Label>
                  <Textarea rows={2} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
                </div>

                {form.type === "multiple_choice" && (
                  <div className="space-y-2">
                    <Label>Alternativas (marque a correta) *</Label>
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="correct" checked={form.correct_answer === i}
                          onChange={() => setForm({ ...form, correct_answer: i })} />
                        <Input value={opt} placeholder={`Alternativa ${i + 1}`}
                          onChange={(e) => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }} />
                        {form.options.length > 2 && (
                          <button onClick={() => setForm({ ...form, options: form.options.filter((_, x) => x !== i), correct_answer: 0 })}
                            className="p-1.5 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, ""] })} className="gap-1">
                      <Plus className="h-3 w-3" /> Adicionar alternativa
                    </Button>
                  </div>
                )}

                {form.type === "true_false" && (
                  <div className="space-y-2">
                    <Label>Resposta correta *</Label>
                    <div className="flex gap-3">
                      {["Verdadeiro", "Falso"].map((l, i) => (
                        <label key={l} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${form.correct_answer === i ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground"}`}>
                          <input type="radio" name="tf" className="sr-only" checked={form.correct_answer === i}
                            onChange={() => setForm({ ...form, correct_answer: i })} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {form.type === "essay" && (
                  <div className="space-y-2">
                    <Label>Gabarito / resposta esperada *</Label>
                    <Textarea rows={3} value={form.expected_answer} onChange={(e) => setForm({ ...form, expected_answer: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      Questões dissertativas não entram no cálculo automático — ficam registradas para correção manual.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Explicação (exibida no gabarito ao aluno)</Label>
                  <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
                </div>

                <Button onClick={saveQuestion} className="gap-1 bg-primary text-primary-foreground">
                  <Save className="h-4 w-4" /> {form.id ? "Salvar alterações" : "Adicionar questão"}
                </Button>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {questions.length === 0 ? (
                <div className="card-surface p-10 text-center text-sm text-muted-foreground">Nenhuma questão cadastrada.</div>
              ) : questions.map((q, i) => (
                <div key={q.id} className="card-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{typeLabel[q.type]}</Badge>
                          {!q.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-foreground">{q.question}</p>
                        {q.type === "essay" ? (
                          <p className="mt-1 text-xs text-muted-foreground">Gabarito: {q.expected_answer}</p>
                        ) : (
                          <div className="mt-2 space-y-1">
                            {(q.options || []).map((opt, oi) => (
                              <p key={oi} className={`text-xs ${oi === q.correct_answer ? "text-success font-medium" : "text-muted-foreground"}`}>
                                {oi === q.correct_answer ? "✓" : "○"} {opt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch checked={q.is_active} onCheckedChange={() => toggleQuestion(q)} />
                      <button onClick={() => openEdit(q)} className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteQuestion(q.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Resultados ── */}
          <TabsContent value="resultados" className="mt-4">
            {attempts.length === 0 ? (
              <div className="card-surface p-10 text-center text-sm text-muted-foreground">Nenhuma tentativa registrada.</div>
            ) : (
              <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{attempts.length} tentativa(s) registradas</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    exportAttemptsCsv(attempts.map((a) => ({ ...a, passing_score: exam?.passing_score })), trackTitle);
                    toast.success("CSV exportado!");
                  }}>
                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const ok = exportAttemptsPdf(attempts.map((a) => ({ ...a, passing_score: exam?.passing_score })), trackTitle);
                    if (!ok) toast.error("Permita pop-ups para gerar o PDF.");
                  }}>
                    <FileText className="mr-2 h-4 w-4" /> Exportar PDF
                  </Button>
                </div>
              </div>
              <div className="card-surface overflow-x-auto">

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/50">
                      {["Aluno", "Tentativa", "Acertos", "Nota", "Tempo", "Situação", "Data"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{a.nome}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">#{a.attempt_number}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">{a.correct_count}/{a.total_questions}</td>
                        <td className={`px-4 py-3 text-sm font-bold tabular-nums ${a.passed ? "text-success" : "text-destructive"}`}>{a.percent}%</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                          {Math.floor(a.duration_seconds / 60)}m {a.duration_seconds % 60}s
                        </td>
                        <td className="px-4 py-3">
                          {a.passed ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success"><CheckCircle2 className="h-3 w-3" /> Aprovado</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"><XCircle className="h-3 w-3" /> Reprovado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AdminLayout>
  );
};

export default AdminProvas;
