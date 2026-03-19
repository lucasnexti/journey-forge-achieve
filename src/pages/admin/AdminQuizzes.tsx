import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save, X, ClipboardCheck, HelpCircle } from "lucide-react";

const AdminQuizzes = () => {
  const [tracks, setTracks] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ title: "", track_id: "", passing_score: 70 });
  const [showNewQ, setShowNewQ] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question: "", options: ["", "", "", ""], correct_answer: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTracks(), fetchQuizzes()]);
  }, []);

  useEffect(() => { if (selectedQuiz) fetchQuestions(selectedQuiz); }, [selectedQuiz]);

  const fetchTracks = async () => { const { data } = await supabase.from("tracks").select("id, title").eq("is_active", true); if (data) setTracks(data); };
  const fetchQuizzes = async () => { setLoading(true); const { data } = await supabase.from("quizzes").select("*, tracks(title)").order("created_at"); if (data) setQuizzes(data); setLoading(false); };
  const fetchQuestions = async (qid: string) => { const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", qid).order("order_index"); if (data) setQuestions(data); };

  const handleCreateQuiz = async () => {
    if (!newQuiz.title || !newQuiz.track_id) { toast.error("Preencha título e trilha."); return; }
    const { error } = await supabase.from("quizzes").insert({ title: newQuiz.title, track_id: newQuiz.track_id, passing_score: newQuiz.passing_score });
    if (error) toast.error(error.message);
    else { toast.success("Quiz criado!"); setShowNew(false); setNewQuiz({ title: "", track_id: "", passing_score: 70 }); fetchQuizzes(); }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Excluir este quiz e todas as perguntas?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    if (selectedQuiz === id) { setSelectedQuiz(null); setQuestions([]); }
    toast.success("Quiz excluído."); fetchQuizzes();
  };

  const handleAddQuestion = async () => {
    if (!selectedQuiz || !newQuestion.question.trim()) { toast.error("Preencha a pergunta."); return; }
    const validOptions = newQuestion.options.filter(o => o.trim());
    if (validOptions.length < 2) { toast.error("Mínimo 2 opções."); return; }
    const { error } = await supabase.from("quiz_questions").insert({
      quiz_id: selectedQuiz,
      question: newQuestion.question,
      options: validOptions,
      correct_answer: newQuestion.correct_answer,
      order_index: questions.length + 1,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pergunta adicionada!"); setShowNewQ(false); setNewQuestion({ question: "", options: ["", "", "", ""], correct_answer: 0 }); fetchQuestions(selectedQuiz); }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    await supabase.from("quiz_questions").delete().eq("id", id);
    toast.success("Pergunta removida."); if (selectedQuiz) fetchQuestions(selectedQuiz);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Quizzes e Avaliações</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <Button onClick={() => setShowNew(!showNew)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? "Cancelar" : "Novo Quiz"}
        </Button>
      </div>

      {showNew && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Título *</Label><Input value={newQuiz.title} onChange={e => setNewQuiz({ ...newQuiz, title: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Trilha *</Label>
              <Select value={newQuiz.track_id} onValueChange={v => setNewQuiz({ ...newQuiz, track_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Nota mínima (%)</Label><Input type="number" value={newQuiz.passing_score} onChange={e => setNewQuiz({ ...newQuiz, passing_score: Number(e.target.value) })} /></div>
          </div>
          <Button onClick={handleCreateQuiz} className="bg-primary text-primary-foreground"><Save className="h-4 w-4 mr-1" /> Criar Quiz</Button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Quizzes ({quizzes.length})</h3>
          {loading ? (
            <div className="card-surface p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : (
            <div className="space-y-2">
              {quizzes.map(q => (
                <div key={q.id} onClick={() => setSelectedQuiz(q.id)} className={`card-surface p-4 cursor-pointer transition-colors ${selectedQuiz === q.id ? "ring-2 ring-primary" : "hover:bg-secondary/30"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{q.title}</p>
                        <p className="text-xs text-muted-foreground">{q.tracks?.title} · Nota mín: {q.passing_score}%</p>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteQuiz(q.id); }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {selectedQuiz ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Perguntas ({questions.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setShowNewQ(!showNewQ)} className="gap-1">
                  {showNewQ ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showNewQ ? "Cancelar" : "Nova Pergunta"}
                </Button>
              </div>

              {showNewQ && (
                <div className="card-surface p-4 mb-3 space-y-3">
                  <Input value={newQuestion.question} onChange={e => setNewQuestion({ ...newQuestion, question: e.target.value })} placeholder="Pergunta *" />
                  {newQuestion.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={newQuestion.correct_answer === i} onChange={() => setNewQuestion({ ...newQuestion, correct_answer: i })} />
                      <Input value={opt} onChange={e => { const o = [...newQuestion.options]; o[i] = e.target.value; setNewQuestion({ ...newQuestion, options: o }); }} placeholder={`Opção ${i + 1}`} />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Marque o radio da resposta correta.</p>
                  <Button size="sm" onClick={handleAddQuestion} className="bg-primary text-primary-foreground"><Save className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
              )}

              <div className="space-y-2">
                {questions.length === 0 ? (
                  <div className="card-surface p-8 text-center text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</div>
                ) : questions.map((q, i) => (
                  <div key={q.id} className="card-surface p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="tabular-nums text-xs font-medium text-muted-foreground mt-0.5">{i + 1}.</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{q.question}</p>
                          <div className="mt-2 space-y-1">
                            {(q.options as string[]).map((opt: string, oi: number) => (
                              <p key={oi} className={`text-xs ${oi === q.correct_answer ? "text-success font-medium" : "text-muted-foreground"}`}>
                                {oi === q.correct_answer ? "✓" : "○"} {opt}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card-surface p-12 text-center text-sm text-muted-foreground">Selecione um quiz para gerenciar suas perguntas.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQuizzes;
