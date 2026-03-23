import { useState } from "react";
import { Quiz } from "@/lib/data";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface QuizFormProps {
  quiz: Quiz & { quizId?: string };
  onSubmit: (score: number, passed: boolean) => void;
  previousScore: number | null;
}

const QuizForm = ({ quiz, onSubmit, previousScore }: QuizFormProps) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [retryDelay, setRetryDelay] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, number>>({});

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!quiz.quizId) return;
    setSubmitting(true);

    // Use server-side validation
    const { data: result } = await supabase.rpc("validate_quiz_attempt", {
      _user_id: (await supabase.auth.getUser()).data.user?.id || "",
      _quiz_id: quiz.quizId,
      _answers: answers,
    });

    const resultData = result as any;
    const pct = resultData?.score || 0;
    const passed = resultData?.passed || false;

    // Extract correct answers from server response
    if (resultData?.details) {
      const corrects: Record<string, number> = {};
      (resultData.details as any[]).forEach((d: any) => {
        corrects[d.question_id] = d.correct_answer;
      });
      setCorrectAnswers(corrects);
    }

    setScore(pct);
    setSubmitted(true);
    setSubmitting(false);
    onSubmit(pct, passed);

    if (!passed) {
      setRetryDelay(true);
      setTimeout(() => setRetryDelay(false), 3000);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setCorrectAnswers({});
  };

  const passed = score !== null && score >= quiz.passingScore;

  return (
    <div className="card-surface p-6">
      <h3 className="font-display text-lg font-semibold text-foreground">Avaliação</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Nota mínima: {quiz.passingScore}%
        {previousScore !== null && (
          <span className="ml-2">· Última nota: <span className="tabular-nums font-medium">{previousScore}%</span></span>
        )}
      </p>

      <div className="mt-6 space-y-6">
        {quiz.questions.map((q, qi) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-foreground">
              {qi + 1}. {q.text}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi;
                const isCorrect = submitted && correctAnswers[q.id] === oi;
                const isWrong = submitted && selected && correctAnswers[q.id] !== oi;

                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      isCorrect
                        ? "border-success/30 bg-success/5 text-foreground"
                        : isWrong
                        ? "border-destructive/30 bg-destructive/5 text-foreground"
                        : selected
                        ? "border-primary/50 bg-primary/5 text-foreground"
                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                    } ${submitted ? "pointer-events-none" : ""}`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                      className="sr-only"
                      disabled={submitted}
                    />
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                    </div>
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {submitted && score !== null && (
        <div
          className={`mt-6 flex items-center gap-3 rounded-lg p-4 ${
            passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {passed ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {passed ? "Parabéns! Você foi aprovado!" : "Nota insuficiente."}
            </p>
            <p className="text-xs mt-0.5">
              Sua nota: <span className="tabular-nums font-semibold">{score}%</span>
              {!passed && " — Revise o conteúdo e tente novamente."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6">
        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full bg-gradient-nexti text-primary-foreground hover:opacity-90"
          >
            {submitting ? "Validando..." : "Enviar Respostas"}
          </Button>
        ) : !passed ? (
          <Button
            onClick={handleRetry}
            disabled={retryDelay}
            variant="outline"
            className="w-full"
          >
            {retryDelay ? "Aguarde..." : "Tentar Novamente"}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default QuizForm;
