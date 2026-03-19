import { useState } from "react";
import { Quiz } from "@/lib/data";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizFormProps {
  quiz: Quiz;
  onSubmit: (score: number, passed: boolean) => void;
  previousScore: number | null;
}

const QuizForm = ({ quiz, onSubmit, previousScore }: QuizFormProps) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [retryDelay, setRetryDelay] = useState(false);

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  const handleSubmit = () => {
    let correct = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    const pct = Math.round((correct / quiz.questions.length) * 100);
    const passed = pct >= quiz.passingScore;
    setScore(pct);
    setSubmitted(true);
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
                const isCorrect = submitted && oi === q.correctIndex;
                const isWrong = submitted && selected && oi !== q.correctIndex;

                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      isCorrect
                        ? "border-success/30 bg-success/5 text-foreground"
                        : isWrong
                        ? "border-destructive/30 bg-destructive/5 text-foreground"
                        : selected
                        ? "border-accent bg-accent/5 text-foreground"
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
                        selected ? "border-accent bg-accent" : "border-border"
                      }`}
                    >
                      {selected && <div className="h-2 w-2 rounded-full bg-card" />}
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
            disabled={!allAnswered}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Enviar Respostas
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
