import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExamTabLock } from "@/hooks/useExamTabLock";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle, CheckCircle2, ClipboardCheck, Clock, Cloud, Lock, MonitorX, RotateCcw, XCircle,
} from "lucide-react";



export interface ExamQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "essay";
  question: string;
  options: { index: number; text: string }[];
  points: number;
}

export interface ExamPayload {
  exam_id: string;
  title: string;
  description: string | null;
  passing_score: number;
  time_limit_minutes: number | null;
  max_attempts?: number | null;
  attempts_used?: number | null;
  attempts_left?: number | null;
  session_id?: string;
  server_now?: string;
  started_at?: string;
  expires_at?: string | null;
  elapsed_seconds?: number;
  questions: ExamQuestion[];
}

export interface ExamResult {
  percent: number;
  score: number;
  correct: number;
  total: number;
  passing_score: number;
  passed: boolean;
  attempt_number: number;
  max_attempts?: number | null;
  attempts_used?: number | null;
  attempts_left?: number | null;
  details: any[];
}

interface ExamRunnerProps {
  trackId: string;
  locked: boolean;
  lockedReason?: string;
  onFinished: (result: ExamResult) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  no_exam: "Nenhuma avaliação ativa foi configurada para este curso.",
  not_enrolled: "Você precisa estar matriculado neste curso.",
  lessons_incomplete: "Conclua 100% das aulas para liberar a avaliação.",
  attempt_limit_reached: "Você atingiu o limite de tentativas desta avaliação.",
  unauthenticated: "Sessão expirada. Faça login novamente.",
  no_active_session: "Nenhuma tentativa ativa encontrada. Inicie a avaliação novamente.",
};


// Rascunho local: mantém questões sorteadas, respostas e início da tentativa
interface ExamDraft {
  exam: ExamPayload;
  answers: Record<string, string>;
  startedAt: number;
  savedAt: number;
}

const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

const ExamRunner = ({ trackId, locked, lockedReason, onFinished }: ExamRunnerProps) => {
  const { user } = useAuth();
  const [exam, setExam] = useState<ExamPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [blocked, setBlocked] = useState<{ used: number; max: number } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);


  const draftKey = user ? `nexti:exam-draft:${user.id}:${trackId}` : null;
  const lockKey = user ? `nexti:exam-lock:${user.id}:${trackId}` : null;
  const { acquire, release, isHeldByOtherTab, blockedByOtherTab, setBlockedByOtherTab, lockSecondsLeft } =
    useExamTabLock(lockKey);

  const clearDraft = useCallback(() => {
    if (draftKey) localStorage.removeItem(draftKey);
    setSavedAt(null);
  }, [draftKey]);

  // ── Retomada automática após atualizar/fechar a página ──
  const restoredOnceRef = useRef(false);
  useEffect(() => {
    if (!draftKey || exam || result || restoredOnceRef.current) return;
    let draft: ExamDraft | null = null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      draft = JSON.parse(raw) as ExamDraft;
      if (!draft?.exam?.questions?.length || !draft.startedAt || Date.now() - draft.startedAt > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(draftKey);
        return;
      }
    } catch {
      localStorage.removeItem(draftKey);
      return;
    }
    // não recupera se outra aba já está com esta prova aberta
    if (!acquire()) return;
    restoredOnceRef.current = true;

    setExam(draft.exam);
    setAnswers(draft.answers || {});
    setStartedAt(draft.startedAt);
    setElapsed(Math.floor((Date.now() - draft.startedAt) / 1000));
    setSavedAt(draft.savedAt || null);
    setRestored(true);
    toast.info("Avaliação retomada — suas respostas e o tempo foram mantidos.");

    // sincroniza o cronômetro com a sessão oficial do servidor
    (async () => {
      const { data, error } = await supabase.rpc("start_exam_attempt", { _track_id: trackId });
      if (error) return;
      const payload = data as unknown as (ExamPayload & { error?: string });
      if (payload?.error || payload?.elapsed_seconds == null) return;
      const serverElapsed = Math.max(payload.elapsed_seconds, 0);
      setStartedAt(Date.now() - serverElapsed * 1000);
      setElapsed(serverElapsed);
    })();
  }, [draftKey, exam, result, acquire, trackId]);


  // ── Salvamento automático (a cada alteração) ──
  const saveDraft = useCallback(() => {
    if (!draftKey || !exam || !startedAt || result) return;
    const now = Date.now();
    try {
      const draft: ExamDraft = { exam, answers, startedAt, savedAt: now };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setSavedAt(now);
    } catch {
      /* storage indisponível — a prova continua normalmente */
    }
  }, [draftKey, exam, answers, startedAt, result]);

  useEffect(() => { saveDraft(); }, [saveDraft]);

  // ── Auto-salvamento periódico (rede de segurança a cada 10s) ──
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  useEffect(() => {
    if (!exam || result) return;
    const t = setInterval(() => saveDraftRef.current(), 10000);
    const onHide = () => saveDraftRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [exam, result]);


  // Confirmação antes de fechar/atualizar a aba com prova em andamento
  useEffect(() => {
    if (!exam || result) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // exigido por navegadores legados para exibir o diálogo nativo
      e.returnValue = "Você tem uma avaliação em andamento. Se sair agora, respostas não enviadas podem ser perdidas.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [exam, result]);

  // Confirmação ao usar voltar/avançar do navegador durante a prova
  useEffect(() => {
    if (!exam || result) return;
    window.history.pushState({ examGuard: true }, "");
    const onPopState = () => {
      setLeaveOpen(true);
      // mantém o usuário na prova até ele confirmar a saída
      window.history.pushState({ examGuard: true }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [exam, result]);


  useEffect(() => {
    if (!startedAt || result) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    // recalcula ao voltar para a aba (timers são congelados em background)
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [startedAt, result]);

  const timeLeft = useMemo(() => {
    if (!exam?.time_limit_minutes) return null;
    return Math.max(exam.time_limit_minutes * 60 - elapsed, 0);
  }, [exam, elapsed]);

  const answeredCount = exam ? exam.questions.filter((q) => answers[q.id]?.trim()).length : 0;
  const allAnswered = exam ? answeredCount === exam.questions.length : false;

  const handleStart = async () => {
    // impede abrir a mesma prova em duas abas ao mesmo tempo
    if (!acquire()) {
      toast.error("Esta avaliação já está aberta em outra aba. Feche-a para continuar aqui.");
      return;
    }
    setStarting(true);
    const { data, error } = await supabase.rpc("start_exam_attempt", { _track_id: trackId });
    setStarting(false);
    if (error) { release(); toast.error(error.message); return; }
    const payload = data as unknown as (ExamPayload & { error?: string; max_attempts?: number; attempts_used?: number });
    if (payload?.error) {
      release();
      if (payload.error === "attempt_limit_reached") {
        setBlocked({ used: payload.attempts_used ?? 0, max: payload.max_attempts ?? 0 });
      }
      toast.error(ERROR_MESSAGES[payload.error] || payload.error);
      return;
    }

    if (!payload?.questions?.length) { release(); toast.error("Esta avaliação ainda não possui questões cadastradas."); return; }
    clearDraft();
    setExam(payload);
    setAnswers({});
    setResult(null);
    setRestored(false);
    // o início oficial é o do servidor (a sessão pode já estar em andamento)
    const serverElapsed = Math.max(payload.elapsed_seconds ?? 0, 0);
    setStartedAt(Date.now() - serverElapsed * 1000);
    setElapsed(serverElapsed);
  };

  /** Retoma a prova nesta aba assim que o lock da outra aba expira. */
  const handleResumeHere = async () => {
    if (isHeldByOtherTab()) {
      toast.error("A outra aba ainda está com a avaliação aberta.");
      return;
    }
    if (!acquire()) {
      toast.error("Não foi possível assumir a avaliação nesta aba.");
      return;
    }
    setBlockedByOtherTab(false);

    // 1) rascunho local — preserva respostas e tempo já decorrido
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as ExamDraft;
          if (draft?.exam?.questions?.length && draft.startedAt && Date.now() - draft.startedAt <= DRAFT_MAX_AGE_MS) {
            setExam(draft.exam);
            setAnswers(draft.answers || {});
            setStartedAt(draft.startedAt);
            setElapsed(Math.floor((Date.now() - draft.startedAt) / 1000));
            setSavedAt(draft.savedAt || null);
            setRestored(true);
            toast.success("Avaliação retomada nesta aba — respostas e tempo mantidos.");
            return;
          }
        }
      } catch { /* segue para o servidor */ }
    }

    // 2) sem rascunho: o servidor devolve a mesma sessão em andamento (tempo real preservado)
    await handleStart();
  };



  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (!exam || submittingRef.current) return;
    // se o lock foi tomado por outra aba, esta aba não pode enviar
    if (isHeldByOtherTab()) {
      toast.error("Esta avaliação foi assumida por outra aba. Continue por lá para enviar.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_exam_attempt", {
      _exam_id: exam.exam_id,
      _answers: answers,
      _duration_seconds: elapsed,
    });
    setSubmitting(false);
    submittingRef.current = false;
    if (error) { toast.error(error.message); return; }
    const res = data as unknown as (ExamResult & { error?: string; max_attempts?: number; attempts_used?: number });
    if (res?.error) {
      if (res.error === "attempt_limit_reached") {
        setBlocked({ used: res.attempts_used ?? 0, max: res.max_attempts ?? 0 });
        clearDraft();
        release();
        setExam(null);
      }
      toast.error(ERROR_MESSAGES[res.error] || res.error);
      return;
    }

    clearDraft();
    release();
    setResult(res);
    setStartedAt(null);
    onFinished(res);
  };


  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && exam && !result && !submitting) {
      toast.warning("Tempo esgotado — enviando respostas.");
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;


  // ── Bloqueio por outra aba ──
  if (blockedByOtherTab && !result) {
    const left = lockSecondsLeft ?? 0;
    const released = left <= 0;
    return (
      <div className="card-surface p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <MonitorX className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="mt-3 font-display text-base font-bold text-foreground">Avaliação aberta em outra aba</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Para evitar tentativas duplicadas, esta prova só pode ser respondida em uma aba por vez.
          Continue na aba onde a avaliação já está em andamento ou feche-a e recarregue esta página.
        </p>
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
          {released ? (
            <p className="text-sm font-medium text-success">Bloqueio liberado — você já pode continuar nesta aba.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Liberação automática se a outra aba for fechada em</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{fmt(left)}</p>
            </>
          )}
        </div>
        <Button
          variant={released ? "default" : "outline"}
          className="mt-4 w-full gap-2"
          disabled={!released || starting}
          onClick={handleResumeHere}
        >
          <RotateCcw className="h-4 w-4" />
          {released ? "Retomar avaliação nesta aba" : "Aguardando liberação..."}
        </Button>

      </div>
    );
  }


  // ── Resultado ──

  if (result) {
    return (
      <div className="card-surface p-6">
        <div className={`flex items-center gap-3 rounded-lg p-4 ${result.passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {result.passed ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <XCircle className="h-6 w-6 shrink-0" />}
          <div>
            <p className="font-display text-base font-bold">
              {result.passed ? "Aprovado! 🎉" : "Reprovado"}
            </p>
            <p className="text-xs mt-0.5">
              {result.passed
                ? "Curso concluído e certificado liberado."
                : (result as any).course_reset
                ? "Você esgotou as tentativas. Seu progresso foi reiniciado — refaça todo o curso para tentar novamente."
                : `Você ainda tem ${result.attempts_left ?? 1} tentativa(s). Revise o conteúdo e tente novamente.`}
            </p>

          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Aproveitamento", value: `${result.percent}%` },
            { label: "Acertos", value: `${result.correct}/${result.total}` },
            { label: "Nota mínima", value: `${result.passing_score}%` },
            { label: "Tentativa", value: `#${result.attempt_number}` },
            {
              label: "Tentativas restantes",
              value: result.max_attempts && result.max_attempts > 0 ? String(result.attempts_left ?? 0) : "∞",
            },
          ].map((s) => (

            <div key={s.label} className="rounded-lg border border-border/50 p-3 text-center">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-1 tabular-nums font-display text-lg font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {result.passed ? (
        <div className="mt-6 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Gabarito</h4>
          {result.details.map((d: any, i: number) => (

            <div key={d.question_id} className="rounded-lg border border-border/50 p-4">
              <div className="flex items-start gap-2">
                <span className="text-xs tabular-nums text-muted-foreground mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{d.question}</p>
                  {d.pending_review ? (
                    <div className="mt-2 space-y-1.5">
                      <Badge variant="secondary" className="text-[10px]">Dissertativa · aguardando correção</Badge>
                      <p className="text-xs text-muted-foreground">Sua resposta: {d.user_answer || "—"}</p>
                      {d.expected_answer && (
                        <p className="text-xs text-muted-foreground">Gabarito esperado: {d.expected_answer}</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {(Array.isArray(d.options) ? d.options : []).map((opt: string, oi: number) => {
                        const isCorrect = oi === d.correct_answer;
                        const isChosen = oi === d.user_answer;
                        return (
                          <p
                            key={oi}
                            className={`rounded-md px-2 py-1 text-xs ${
                              isCorrect
                                ? "bg-success/10 text-success font-medium"
                                : isChosen
                                ? "bg-destructive/10 text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isCorrect ? "✓" : isChosen ? "✕" : "○"} {opt}
                          </p>
                        );
                      })}
                      {d.explanation && (
                        <p className="mt-2 text-xs text-muted-foreground italic">{d.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        ) : (
          <p className="mt-6 rounded-lg border border-border/50 p-4 text-xs text-muted-foreground">
            O gabarito não é exibido em tentativas reprovadas. Revise o conteúdo do curso antes da próxima tentativa.
          </p>
        )}

      </div>
    );
  }

  // ── Prova em andamento ──
  if (exam) {
    return (
      <div className="card-surface p-6">
        <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair da avaliação?</AlertDialogTitle>
              <AlertDialogDescription>
                Você tem uma avaliação em andamento. Suas respostas ficam salvas como rascunho,
                mas a tentativa continua contando e o tempo segue correndo no servidor.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuar prova</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setLeaveOpen(false); setExam(null); }}>
                Sair mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">{exam.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nota mínima: {exam.passing_score}% · {exam.questions.length} questões
              {exam.max_attempts && exam.max_attempts > 0
                ? ` · Tentativa ${(exam.attempts_used ?? 0) + 1} de ${exam.max_attempts}`
                : ""}

            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" />
              {savedAt
                ? `Salvo às ${new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : "Salvamento automático"}
            </span>
            <div className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
              <Clock className="h-4 w-4" />
              {timeLeft !== null ? fmt(timeLeft) : fmt(elapsed)}
            </div>
          </div>
        </div>

        {restored && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
            Tentativa recuperada automaticamente — respostas e tempo total preservados.
          </div>
        )}


        <div className="mt-4 flex items-center gap-2">
          <Progress value={(answeredCount / exam.questions.length) * 100} className="h-1.5 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{answeredCount}/{exam.questions.length}</span>
        </div>

        <div className="mt-6 space-y-6">
          {exam.questions.map((q, qi) => (
            <div key={q.id}>
              <div className="flex items-start gap-2">
                <p className="text-sm font-medium text-foreground">{qi + 1}. {q.question}</p>
              </div>
              {q.type === "essay" ? (
                <Textarea
                  className="mt-3"
                  rows={4}
                  placeholder="Digite sua resposta..."
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === String(opt.index);
                    return (
                      <label
                        key={opt.index}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                          selected
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-border/50 text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          className="sr-only"
                          checked={selected}
                          onChange={() => setAnswers({ ...answers, [q.id]: String(opt.index) })}
                        />
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-border"}`}>
                          {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                        </div>
                        {opt.text}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {!allAnswered && (
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> Responda todas as questões para enviar.
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="mt-5 w-full bg-gradient-nexti text-primary-foreground hover:opacity-90"
        >
          {submitting ? "Corrigindo..." : "Enviar Avaliação"}
        </Button>
      </div>
    );
  }

  // ── Tela inicial ──
  const attemptsExhausted = !!blocked && blocked.max > 0 && blocked.used >= blocked.max;
  return (
    <div className="card-surface p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        {locked || attemptsExhausted ? <Lock className="h-5 w-5 text-primary" /> : <ClipboardCheck className="h-5 w-5 text-primary" />}
      </div>
      <h3 className="mt-3 font-display text-base font-bold text-foreground">Avaliação Final</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {attemptsExhausted
          ? `Limite de tentativas atingido (${blocked!.used}/${blocked!.max}). Procure o administrador para liberar uma nova tentativa.`
          : locked
            ? lockedReason || "Conclua 100% das aulas para liberar a avaliação."
            : "As questões e alternativas são embaralhadas a cada tentativa."}
      </p>
      <Button
        onClick={handleStart}
        disabled={locked || starting || attemptsExhausted}
        className="mt-4 w-full gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90 h-11"
      >
        {starting ? <RotateCcw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        {attemptsExhausted ? "Tentativas esgotadas" : "Realizar Avaliação"}
      </Button>
    </div>
  );

};

export default ExamRunner;
