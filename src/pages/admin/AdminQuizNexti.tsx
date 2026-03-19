import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit, BookOpen, Sparkles, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { playbookSupabase } from "@/lib/playbookClient";

interface Module {
  id: string;
  title: string;
  description: string | null;
  playbook_section_title: string | null;
  is_active: boolean;
  order_index: number;
}

interface Question {
  id: string;
  module_id: string;
  question: string;
  type: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  order_index: number;
}

const AdminQuizNexti = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playbookSections, setPlaybookSections] = useState<{ id: string; title: string }[]>([]);

  // Module form
  const [moduleDialog, setModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", playbook_section_title: "" });

  // Question form
  const [questionDialog, setQuestionDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qForm, setQForm] = useState({
    question: "",
    type: "multiple_choice",
    options: ["", "", "", ""],
    correct_answer: 0,
    explanation: "",
  });

  // AI generation
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCount, setAiCount] = useState("5");

  useEffect(() => {
    loadData();
    loadPlaybookSections();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: mods } = await supabase
      .from("kb_quiz_modules")
      .select("*")
      .order("order_index");
    setModules((mods as Module[]) || []);

    const { data: qs } = await supabase
      .from("kb_quiz_questions")
      .select("*")
      .order("order_index");
    setQuestions((qs as any[])?.map(q => ({ ...q, options: q.options as string[] })) || []);

    if (mods && mods.length > 0 && !selectedModule) {
      setSelectedModule(mods[0].id);
    }
    setLoading(false);
  };

  const loadPlaybookSections = async () => {
    try {
      const { data } = await playbookSupabase
        .from("kb_sections")
        .select("id, title")
        .order("sort_order");
      if (data) setPlaybookSections(data);
    } catch {
      // ignore
    }
  };

  // ======= MODULE CRUD =======
  const openModuleForm = (mod?: Module) => {
    if (mod) {
      setEditingModule(mod);
      setModuleForm({ title: mod.title, description: mod.description || "", playbook_section_title: mod.playbook_section_title || "" });
    } else {
      setEditingModule(null);
      setModuleForm({ title: "", description: "", playbook_section_title: "" });
    }
    setModuleDialog(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) { toast.error("Título obrigatório"); return; }
    if (editingModule) {
      await supabase.from("kb_quiz_modules").update({
        title: moduleForm.title,
        description: moduleForm.description || null,
        playbook_section_title: moduleForm.playbook_section_title || null,
      }).eq("id", editingModule.id);
      toast.success("Módulo atualizado");
    } else {
      await supabase.from("kb_quiz_modules").insert({
        title: moduleForm.title,
        description: moduleForm.description || null,
        playbook_section_title: moduleForm.playbook_section_title || null,
        order_index: modules.length,
      });
      toast.success("Módulo criado");
    }
    setModuleDialog(false);
    loadData();
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Excluir módulo e todas as perguntas?")) return;
    await supabase.from("kb_quiz_modules").delete().eq("id", id);
    toast.success("Módulo excluído");
    if (selectedModule === id) setSelectedModule(null);
    loadData();
  };

  const syncModulesFromPlaybook = async () => {
    if (playbookSections.length === 0) {
      toast.error("Nenhuma seção encontrada no Playbook");
      return;
    }
    let created = 0;
    for (const sec of playbookSections) {
      const exists = modules.some(m => m.playbook_section_title === sec.title);
      if (!exists) {
        await supabase.from("kb_quiz_modules").insert({
          title: sec.title,
          playbook_section_title: sec.title,
          order_index: modules.length + created,
        });
        created++;
      }
    }
    toast.success(`${created} módulos sincronizados do Playbook`);
    loadData();
  };

  // ======= QUESTION CRUD =======
  const openQuestionForm = (q?: Question) => {
    if (q) {
      setEditingQuestion(q);
      const opts = q.type === "true_false"
        ? ["Verdadeiro", "Falso", "", ""]
        : [...(q.options || []), "", "", "", ""].slice(0, 4);
      setQForm({
        question: q.question,
        type: q.type,
        options: opts,
        correct_answer: q.correct_answer,
        explanation: q.explanation || "",
      });
    } else {
      setEditingQuestion(null);
      setQForm({ question: "", type: "multiple_choice", options: ["", "", "", ""], correct_answer: 0, explanation: "" });
    }
    setQuestionDialog(true);
  };

  const saveQuestion = async () => {
    if (!selectedModule) return;
    if (!qForm.question.trim()) { toast.error("Pergunta obrigatória"); return; }

    const options = qForm.type === "true_false"
      ? ["Verdadeiro", "Falso"]
      : qForm.options.filter(o => o.trim());

    if (qForm.type === "multiple_choice" && options.length < 2) {
      toast.error("Adicione pelo menos 2 opções");
      return;
    }

    const data = {
      module_id: selectedModule,
      question: qForm.question,
      type: qForm.type,
      options,
      correct_answer: qForm.correct_answer,
      explanation: qForm.explanation || null,
    };

    if (editingQuestion) {
      await supabase.from("kb_quiz_questions").update(data).eq("id", editingQuestion.id);
      toast.success("Pergunta atualizada");
    } else {
      const moduleQs = questions.filter(q => q.module_id === selectedModule);
      await supabase.from("kb_quiz_questions").insert({ ...data, order_index: moduleQs.length });
      toast.success("Pergunta criada");
    }
    setQuestionDialog(false);
    loadData();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    await supabase.from("kb_quiz_questions").delete().eq("id", id);
    toast.success("Pergunta excluída");
    loadData();
  };

  // ======= AI GENERATION =======
  const generateWithAI = async () => {
    if (!selectedModule) return;
    const mod = modules.find(m => m.id === selectedModule);
    if (!mod) return;

    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz-questions", {
        body: {
          module_title: mod.title,
          playbook_section: mod.playbook_section_title,
          count: parseInt(aiCount),
        },
      });

      if (error) throw error;

      const generated = data?.questions || [];
      if (generated.length === 0) {
        toast.error("Nenhuma pergunta gerada");
        return;
      }

      const moduleQs = questions.filter(q => q.module_id === selectedModule);
      for (let i = 0; i < generated.length; i++) {
        const g = generated[i];
        await supabase.from("kb_quiz_questions").insert({
          module_id: selectedModule,
          question: g.question,
          type: g.type || "multiple_choice",
          options: g.options,
          correct_answer: g.correct_answer,
          explanation: g.explanation || null,
          order_index: moduleQs.length + i,
        });
      }

      toast.success(`${generated.length} perguntas geradas por IA!`);
      loadData();
    } catch (e: any) {
      toast.error("Erro ao gerar perguntas: " + (e.message || "Desconhecido"));
    } finally {
      setAiGenerating(false);
    }
  };

  const moduleQuestions = questions.filter(q => q.module_id === selectedModule);

  return (
    <AdminLayout>
      <AdminPageShell title="Quiz Nexti — Base de Conhecimento" description="Gerencie módulos e perguntas do quiz vinculado à Base de Conhecimento">
        <Tabs defaultValue="modules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
            <TabsTrigger value="questions">Perguntas</TabsTrigger>
          </TabsList>

          {/* =========== MODULES TAB =========== */}
          <TabsContent value="modules" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => openModuleForm()} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Novo Módulo
              </Button>
              <Button onClick={syncModulesFromPlaybook} size="sm" variant="outline" className="gap-1">
                <BookOpen className="h-4 w-4" /> Sincronizar do Playbook
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Seção Playbook</TableHead>
                    <TableHead>Perguntas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell className="font-medium">{mod.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{mod.playbook_section_title || "—"}</TableCell>
                      <TableCell>{questions.filter(q => q.module_id === mod.id).length}</TableCell>
                      <TableCell>
                        <Badge variant={mod.is_active ? "default" : "secondary"}>
                          {mod.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openModuleForm(mod)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteModule(mod.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {modules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        Nenhum módulo cadastrado. Crie um ou sincronize do Playbook.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* =========== QUESTIONS TAB =========== */}
          <TabsContent value="questions" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedModule || ""} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione um módulo" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={() => openQuestionForm()} size="sm" disabled={!selectedModule} className="gap-1">
                <Plus className="h-4 w-4" /> Nova Pergunta
              </Button>

              <div className="flex items-center gap-2 ml-auto">
                <Select value={aiCount} onValueChange={setAiCount}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["3", "5", "10", "15", "20"].map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={generateWithAI}
                  size="sm"
                  variant="outline"
                  disabled={!selectedModule || aiGenerating}
                  className="gap-1"
                >
                  {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar com IA
                </Button>
              </div>
            </div>

            {selectedModule && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleQuestions.map((q, i) => (
                    <TableRow key={q.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="max-w-md truncate">{q.question}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {q.type === "true_false" ? "V/F" : "Múltipla"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.options[q.correct_answer] || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openQuestionForm(q)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {moduleQuestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        Nenhuma pergunta neste módulo. Crie manualmente ou gere com IA.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        {/* ======= MODULE DIALOG ======= */}
        <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium">Seção do Playbook</label>
                <Select value={moduleForm.playbook_section_title} onValueChange={v => setModuleForm({ ...moduleForm, playbook_section_title: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular a uma seção" />
                  </SelectTrigger>
                  <SelectContent>
                    {playbookSections.map(s => (
                      <SelectItem key={s.id} value={s.title}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveModule} className="w-full gap-1">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ======= QUESTION DIALOG ======= */}
        <Dialog open={questionDialog} onOpenChange={setQuestionDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={qForm.type} onValueChange={v => {
                  const opts = v === "true_false" ? ["Verdadeiro", "Falso", "", ""] : ["", "", "", ""];
                  setQForm({ ...qForm, type: v, options: opts, correct_answer: 0 });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                    <SelectItem value="true_false">Verdadeiro ou Falso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Pergunta *</label>
                <Textarea value={qForm.question} onChange={e => setQForm({ ...qForm, question: e.target.value })} rows={2} />
              </div>

              {qForm.type === "multiple_choice" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opções</label>
                  {qForm.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={qForm.correct_answer === idx}
                        onChange={() => setQForm({ ...qForm, correct_answer: idx })}
                        className="accent-primary"
                      />
                      <Input
                        value={opt}
                        onChange={e => {
                          const opts = [...qForm.options];
                          opts[idx] = e.target.value;
                          setQForm({ ...qForm, options: opts });
                        }}
                        placeholder={`Opção ${String.fromCharCode(65 + idx)}`}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Selecione o radio da resposta correta</p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Resposta correta</label>
                  <Select value={String(qForm.correct_answer)} onValueChange={v => setQForm({ ...qForm, correct_answer: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Verdadeiro</SelectItem>
                      <SelectItem value="1">Falso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Explicação (opcional)</label>
                <Textarea value={qForm.explanation} onChange={e => setQForm({ ...qForm, explanation: e.target.value })} rows={2} />
              </div>

              <Button onClick={saveQuestion} className="w-full gap-1">
                <Save className="h-4 w-4" /> Salvar Pergunta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AdminPageShell>
    </AdminLayout>
  );
};

export default AdminQuizNexti;
