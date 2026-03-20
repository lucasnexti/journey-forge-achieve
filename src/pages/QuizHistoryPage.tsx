import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { History, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Attempt {
  id: string;
  quiz_id: string;
  score: number;
  passed: boolean;
  attempted_at: string;
  quiz_title: string;
  track_title: string;
}

const QuizHistoryPage = () => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, score, passed, attempted_at, quizzes(title, tracks(title))")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false });

      setAttempts(
        (data || []).map((a: any) => ({
          id: a.id,
          quiz_id: a.quiz_id,
          score: a.score,
          passed: a.passed,
          attempted_at: a.attempted_at,
          quiz_title: a.quizzes?.title || "Quiz",
          track_title: a.quizzes?.tracks?.title || "Trilha",
        }))
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
      </div>
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
          <p className="mt-2 text-primary-foreground/80">Todas as suas tentativas de avaliações.</p>
        </div>
      </div>

      <main className="container py-8">
        {attempts.length === 0 ? (
          <div className="card-surface p-8 text-center text-muted-foreground">
            Nenhuma avaliação realizada ainda.
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Trilha</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Avaliação</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Nota</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{a.track_title}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{a.quiz_title}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`tabular-nums text-sm font-bold ${a.passed ? "text-success" : "text-destructive"}`}>
                        {a.score}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
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
                    <td className="px-5 py-4 text-center text-sm text-muted-foreground">
                      {new Date(a.attempted_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default QuizHistoryPage;
