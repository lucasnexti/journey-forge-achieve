import Header from "@/components/Header";
import { tracks } from "@/lib/data";
import { getTrackProgress, getTotalWatchedSeconds, getAverageQuizScore } from "@/lib/progress";
import { Clock, Trophy, BookOpen, User } from "lucide-react";

const ReportPage = () => {
  const totalWatched = getTotalWatchedSeconds();
  const avgScore = getAverageQuizScore();

  const formatTime = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  const trackDetails = tracks.map((track) => {
    const progress = getTrackProgress(track.id);
    const completedLessons = Object.values(progress.lessons).filter(l => l.completed).length;
    const watchedTime = Object.values(progress.lessons).reduce((a, l) => a + l.watchedSeconds, 0);

    return {
      ...track,
      completedLessons,
      watchedTime,
      quizScore: progress.quizScore,
      quizPassed: progress.quizPassed,
      completedAt: progress.completedAt,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Relatório de Desempenho</h1>
        <p className="mt-2 text-muted-foreground">Acompanhe seu progresso nas trilhas da Universidade Cooperativa.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[
            { icon: User, label: "Cooperado(a)", value: "Usuário" },
            { icon: BookOpen, label: "Trilhas Concluídas", value: `${trackDetails.filter(t => t.quizPassed).length}/${tracks.length}` },
            { icon: Clock, label: "Tempo Total", value: formatTime(totalWatched) },
            { icon: Trophy, label: "Nota Média", value: avgScore > 0 ? `${avgScore}%` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="card-surface p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="tabular-nums font-display text-lg font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Detalhamento por Trilha</h2>
          <div className="card-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Trilha</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Aulas</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Tempo</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Nota</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {trackDetails.map((t) => (
                  <tr key={t.id} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.category}</p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="tabular-nums text-sm text-foreground">
                        {t.completedLessons}/{t.totalLessons}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="tabular-nums text-sm text-foreground">
                        {formatTime(t.watchedTime)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="tabular-nums text-sm font-medium text-foreground">
                        {t.quizScore !== null ? `${t.quizScore}%` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {t.quizPassed ? (
                        <span className="inline-flex rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                          Aprovado
                        </span>
                      ) : t.completedLessons > 0 ? (
                        <span className="inline-flex rounded-md bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                          Em andamento
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Não iniciado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportPage;
