import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { History, CheckCircle2, XCircle } from "lucide-react";

interface Attempt {
  id: string;
  kind: "Avaliação Final" | "Quiz";
  title: string;
  track_title: string;
  score: number;
  correct?: string;
  attempt_number?: number;
  duration_seconds?: number;
  passed: boolean;
  attempted_at: string;
}

const QuizHistoryPage = () => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: quizData }, { data: examData }] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select("id, score, passed, attempted_at, quizzes(title, tracks(title))")
          .eq("user_id", user.id)
          .order("attempted_at", { ascending: false }),
        supabase
          .from("exam_attempts")
          .select("id, percent, correct_count, total_questions, passed, duration_seconds, attempt_number, created_at, exams(title), tracks(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const quizzes: Attempt[] = (quizData || []).map((a: any) => ({
        id: a.id,
        kind: "Quiz",
        title: a.quizzes?.title || "Quiz",
        track_title: a.quizzes?.tracks?.title || "Trilha",
        score: a.score,
        passed: a.passed,
        attempted_at: a.attempted_at,
      }));

      const exams: Attempt[] = (examData || []).map((a: any) => ({
        id: a.id,
        kind: "Avaliação Final",
        title: a.exams?.title || "Avaliação Final",
        track_title: a.tracks?.title || "Trilha",
        score: Number(a.percent),
        correct: `${a.correct_count}/${a.total_questions}`,
        attempt_number: a.attempt_number,
        duration_seconds: a.duration_seconds,
        passed: a.passed,
        attempted_at: a.created_at,
      }));

      setAttempts(
        [...exams, ...quizzes].sort(
          (a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime()
        )
      );
      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="bg-gradient-nexti">
        <div className="container py-10">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary-foreground" />
            <h1 className="font-display text-3xl font-extrabold text-primary-foreground">Histórico de Avaliações</h1>
          </div>
          <p className="mt-2 text-primary-foreground/80">Todas as suas tentativas de provas e quizzes.</p>
        </div>
      </div>

      <main className="container py-8">
        {attempts.length === 0 ? (
          <div className="card-surface p-8 text-center text-muted-foreground">
            Nenhuma avaliação realizada ainda.
          </div>
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/50">
                  {["Trilha", "Avaliação", "Tentativa", "Acertos", "Nota", "Tempo", "Status", "Data"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={`${a.kind}-${a.id}`} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-4 text-sm font-medium text-foreground">{a.track_title}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{a.title} · {a.kind}</td>
                    <td className="px-4 py-4 text-sm tabular-nums text-muted-foreground">{a.attempt_number ? `#${a.attempt_number}` : "—"}</td>
                    <td className="px-4 py-4 text-sm tabular-nums text-muted-foreground">{a.correct || "—"}</td>
                    <td className="px-4 py-4">
                      <span className={`tabular-nums text-sm font-bold ${a.passed ? "text-success" : "text-destructive"}`}>{a.score}%</span>
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-muted-foreground">
                      {a.duration_seconds !== undefined
                        ? `${Math.floor(a.duration_seconds / 60)}m ${a.duration_seconds % 60}s`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {a.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" /> Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                          <XCircle className="h-3 w-3" /> Reprovado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {new Date(a.attempted_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppLayout>
  );
};

export default QuizHistoryPage;
