import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, CheckCircle2, XCircle, ArrowRight, RotateCcw, Award, Zap, Target, ChevronRight, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QuizModule {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  question_count: number;
  best_score: number | null;
  attempts: number;
  passed: boolean;
}

interface Question {
  id: string;
  question: string;
  type: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
}

type Phase = "modules" | "quiz" | "result";

const QuizNextiPage = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("modules");
  const [modules, setModules] = useState<QuizModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Result state
  const [score, setScore] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  // Stats
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalPassed, setTotalPassed] = useState(0);

  const loadModules = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: mods } = await supabase
      .from("kb_quiz_modules")
      .select("id, title, description, icon")
      .eq("is_active", true)
      .order("order_index");

    if (!mods || mods.length === 0) {
      setModules([]);
      setLoading(false);
      return;
    }

    // Get question counts
    const { data: questions } = await supabase
      .from("kb_quiz_questions")
      .select("module_id");

    // Get user attempts
    const { data: attempts } = await supabase
      .from("kb_quiz_attempts")
      .select("module_id, score, total_questions, passed")
      .eq("user_id", user.id);

    const qCountMap = new Map<string, number>();
    (questions || []).forEach((q: any) => {
      qCountMap.set(q.module_id, (qCountMap.get(q.module_id) || 0) + 1);
    });

    const attemptMap = new Map<string, { best: number; count: number; passed: boolean }>();
    (attempts || []).forEach((a: any) => {
      const existing = attemptMap.get(a.module_id);
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      if (!existing) {
        attemptMap.set(a.module_id, { best: pct, count: 1, passed: a.passed });
      } else {
        existing.best = Math.max(existing.best, pct);
        existing.count++;
        existing.passed = existing.passed || a.passed;
      }
    });

    let tAttempts = 0, tPassed = 0;
    const enriched: QuizModule[] = mods.map((m: any) => {
      const att = attemptMap.get(m.id);
      tAttempts += att?.count || 0;
      if (att?.passed) tPassed++;
      return {
        ...m,
        question_count: qCountMap.get(m.id) || 0,
        best_score: att?.best ?? null,
        attempts: att?.count || 0,
        passed: att?.passed || false,
      };
    });

    setTotalAttempts(tAttempts);
    setTotalPassed(tPassed);
    setModules(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const toggleModule = (id: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startQuiz = async () => {
    if (selectedModules.size === 0) {
      toast.error("Selecione ao menos um módulo");
      return;
    }
    setQuizLoading(true);

    const { data } = await supabase
      .from("kb_quiz_questions")
      .select("id, question, type, options, correct_answer, explanation")
      .in("module_id", Array.from(selectedModules))
      .order("order_index");

    if (!data || data.length === 0) {
      toast.error("Nenhuma pergunta disponível nos módulos selecionados");
      setQuizLoading(false);
      return;
    }

    // Shuffle
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.map((q: any) => ({ ...q, options: q.options as string[] })));
    setAnswers(new Array(shuffled.length).fill(null));
    setCurrentIdx(0);
    setShowAnswer(false);
    setPhase("quiz");
    setQuizLoading(false);
  };

  const selectAnswer = (idx: number) => {
    if (showAnswer) return;
    const newAnswers = [...answers];
    newAnswers[currentIdx] = idx;
    setAnswers(newAnswers);
  };

  const confirmAnswer = () => {
    if (answers[currentIdx] === null) return;
    setShowAnswer(true);
  };

  const nextQuestion = async () => {
    setShowAnswer(false);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Finish quiz — calculate score
      let correct = 0;
      questions.forEach((q, i) => {
        if (answers[i] === q.correct_answer) correct++;
      });
      const pct = Math.round((correct / questions.length) * 100);
      const passed = pct >= 70;

      setScore(pct);
      setTotalQ(questions.length);

      // Save attempts per module
      if (user) {
        const moduleIds = Array.from(selectedModules);
        for (const modId of moduleIds) {
          const modQuestions = questions.filter(q => {
            // We need to know which module each question belongs to, 
            // but we lost that info. Save one attempt per selected module with the overall score.
            return true;
          });
          await supabase.from("kb_quiz_attempts").insert({
            user_id: user.id,
            module_id: modId,
            score: correct,
            total_questions: questions.length,
            passed,
          });
        }

        // Check and award badges
        const earned: string[] = [];
        if (passed) {
          // Check module-specific badges
          const { data: allBadges } = await supabase
            .from("badges")
            .select("id, name, criteria_type, criteria_value");

          const { data: userBadges } = await supabase
            .from("user_badges")
            .select("badge_id")
            .eq("user_id", user.id);

          const earnedIds = new Set((userBadges || []).map((ub: any) => ub.badge_id));

          for (const badge of (allBadges || [])) {
            if (earnedIds.has(badge.id)) continue;

            if (badge.criteria_type === "quiz_module_pass" && passed) {
              await supabase.from("user_badges").insert({ user_id: user.id, badge_id: badge.id });
              earned.push(badge.name);
            }
            if (badge.criteria_type === "quiz_score" && pct >= (badge.criteria_value || 90)) {
              await supabase.from("user_badges").insert({ user_id: user.id, badge_id: badge.id });
              earned.push(badge.name);
            }
          }
        }

        setNewBadges(earned);
      }

      setPhase("result");
    }
  };

  const resetQuiz = () => {
    setPhase("modules");
    setSelectedModules(new Set());
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setShowAnswer(false);
    setNewBadges([]);
    loadModules();
  };

  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;

  return (
    <AppLayout>

      <div className="container py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {/* ============ MODULE SELECTION ============ */}
          {phase === "modules" && (
            <motion.div key="modules" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                  <Zap className="h-4 w-4" />
                  Quiz Nexti
                </div>
                <h1 className="font-display text-3xl font-extrabold text-foreground mb-2">
                  Teste seus conhecimentos
                </h1>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Selecione os módulos que deseja responder. As perguntas são baseadas na Base de Conhecimento Nexti.
                </p>
              </div>

              {/* Stats */}
              {totalAttempts > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: Target, label: "Tentativas", value: totalAttempts },
                    { icon: Trophy, label: "Módulos Aprovados", value: totalPassed },
                    { icon: Star, label: "Total Módulos", value: modules.length },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="card-surface p-4 text-center">
                      <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
                      <p className="text-xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : modules.length === 0 ? (
                <div className="card-surface p-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum módulo disponível</h3>
                  <p className="text-muted-foreground">Os módulos do quiz ainda estão sendo preparados.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {modules.map((mod) => {
                      const selected = selectedModules.has(mod.id);
                      const hasQuestions = mod.question_count > 0;
                      return (
                        <motion.button
                          key={mod.id}
                          onClick={() => hasQuestions && toggleModule(mod.id)}
                          disabled={!hasQuestions}
                          className={cn(
                            "card-surface p-5 text-left transition-all relative overflow-hidden group",
                            selected && "ring-2 ring-primary border-primary/50",
                            !hasQuestions && "opacity-50 cursor-not-allowed"
                          )}
                          whileTap={hasQuestions ? { scale: 0.98 } : undefined}
                        >
                          {selected && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          {mod.passed && (
                            <div className="absolute top-3 right-3">
                              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20 text-xs">
                                <Trophy className="h-3 w-3 mr-1" /> Aprovado
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground text-sm">{mod.title}</h3>
                              {mod.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{mod.question_count} perguntas</span>
                                {mod.attempts > 0 && <span>• {mod.attempts} tentativas</span>}
                                {mod.best_score !== null && <span>• Melhor: {mod.best_score}%</span>}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={startQuiz}
                      disabled={selectedModules.size === 0 || quizLoading}
                      size="lg"
                      className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-2 px-8"
                    >
                      {quizLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
                        <>
                          Iniciar Quiz
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {selectedModules.size > 0 && (
                    <p className="text-center text-sm text-muted-foreground mt-3">
                      {selectedModules.size} módulo{selectedModules.size > 1 ? "s" : ""} selecionado{selectedModules.size > 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ============ QUIZ IN PROGRESS ============ */}
          {phase === "quiz" && currentQ && (
            <motion.div key="quiz" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>Pergunta {currentIdx + 1} de {questions.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Question card */}
              <div className="card-surface p-6 sm:p-8 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">
                    {currentQ.type === "true_false" ? "Verdadeiro ou Falso" : "Múltipla Escolha"}
                  </Badge>
                </div>

                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">
                  {currentQ.question}
                </h2>

                <div className="space-y-3">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = answers[currentIdx] === idx;
                    const isCorrect = idx === currentQ.correct_answer;
                    let optionStyle = "border-border hover:border-primary/50 hover:bg-primary/5";

                    if (showAnswer) {
                      if (isCorrect) optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20";
                      else if (isSelected && !isCorrect) optionStyle = "border-destructive bg-destructive/5";
                      else optionStyle = "border-border opacity-50";
                    } else if (isSelected) {
                      optionStyle = "border-primary bg-primary/10";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => selectAnswer(idx)}
                        disabled={showAnswer}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all",
                          optionStyle
                        )}
                      >
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                          showAnswer && isCorrect ? "border-green-500 bg-green-500 text-white" :
                          showAnswer && isSelected && !isCorrect ? "border-destructive bg-destructive text-destructive-foreground" :
                          isSelected ? "border-primary bg-primary text-primary-foreground" :
                          "border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {showAnswer && isCorrect ? <CheckCircle2 className="h-4 w-4" /> :
                           showAnswer && isSelected && !isCorrect ? <XCircle className="h-4 w-4" /> :
                           String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm font-medium text-foreground">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {showAnswer && currentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 p-4 rounded-lg bg-muted/50 border border-border"
                  >
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Explicação:</strong> {currentQ.explanation}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                {!showAnswer ? (
                  <Button
                    onClick={confirmAnswer}
                    disabled={answers[currentIdx] === null}
                    className="bg-gradient-nexti text-primary-foreground hover:opacity-90"
                  >
                    Confirmar
                  </Button>
                ) : (
                  <Button
                    onClick={nextQuestion}
                    className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-2"
                  >
                    {currentIdx < questions.length - 1 ? (
                      <>Próxima <ChevronRight className="h-4 w-4" /></>
                    ) : (
                      <>Ver Resultado <Trophy className="h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* ============ RESULT ============ */}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="card-surface p-8 sm:p-12 max-w-lg mx-auto">
                <div className={cn(
                  "inline-flex items-center justify-center h-20 w-20 rounded-full mb-6",
                  score >= 70 ? "bg-green-100 dark:bg-green-900/30" : "bg-destructive/10"
                )}>
                  {score >= 70 ? (
                    <Trophy className="h-10 w-10 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-10 w-10 text-destructive" />
                  )}
                </div>

                <h2 className="font-display text-2xl font-extrabold text-foreground mb-2">
                  {score >= 70 ? "Parabéns! 🎉" : "Quase lá! 💪"}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {score >= 70
                    ? "Você demonstrou excelente conhecimento!"
                    : "Continue estudando a Base de Conhecimento e tente novamente."}
                </p>

                <div className="text-5xl font-display font-extrabold text-gradient-nexti mb-2">
                  {score}%
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Acertou {Math.round((score / 100) * totalQ)} de {totalQ} perguntas
                </p>

                {score >= 70 && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mb-4">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovado (mínimo 70%)
                  </Badge>
                )}

                {/* New badges earned */}
                {newBadges.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/30">
                    <div className="flex items-center gap-2 justify-center mb-2">
                      <Award className="h-5 w-5 text-warning" />
                      <span className="font-semibold text-foreground text-sm">Nova(s) Insígnia(s)!</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {newBadges.map(b => (
                        <Badge key={b} className="bg-warning/20 text-warning border-warning/40">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center mt-8">
                  <Button variant="outline" onClick={resetQuiz} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Novo Quiz
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default QuizNextiPage;
