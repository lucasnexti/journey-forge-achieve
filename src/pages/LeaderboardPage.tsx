import { useAuth } from "@/contexts/AuthContext";
import { useLeaderboard } from "@/hooks/useDashboardData";
import AppLayout from "@/components/AppLayout";
import { Trophy, Medal, Crown, User } from "lucide-react";

interface RankEntry {
  user_id: string;
  nome: string;
  completed: number;
  total: number;
}

const LeaderboardPage = () => {
  const { user } = useAuth();
  const { data, isLoading: loading } = useLeaderboard();
  const empresa = data?.empresa ?? null;
  const ranking = (data?.ranking ?? []) as RankEntry[];

  const getMedal = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-warning" />;
    if (index === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
  };

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
        <div className="container py-6 sm:py-10">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
            <div>
              <h1 className="font-display text-xl sm:text-3xl font-extrabold text-primary-foreground">Ranking</h1>
              <p className="text-xs sm:text-sm text-primary-foreground/80">{empresa || "Sua Empresa"}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container py-4 sm:py-8">
        {!empresa ? (
          <div className="card-surface p-6 sm:p-8 text-center text-muted-foreground">
            Seu perfil não possui empresa vinculada.
          </div>
        ) : ranking.length === 0 ? (
          <div className="card-surface p-6 sm:p-8 text-center text-muted-foreground">
            Nenhum colaborador com matrículas ainda.
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            {ranking.map((entry, i) => {
              const isMe = entry.user_id === user?.id;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-border/30 last:border-0 ${
                    isMe ? "bg-primary/5" : ""
                  } ${i < 3 ? "py-3.5 sm:py-5" : ""}`}
                >
                  <div className="w-7 sm:w-8 flex justify-center shrink-0">{getMedal(i)}</div>
                  <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-secondary shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                      {entry.nome} {isMe && <span className="text-xs text-primary">(você)</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular-nums text-base sm:text-lg font-bold text-foreground">{entry.completed}</p>
                    <p className="text-[10px] text-muted-foreground">concluída{entry.completed !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="hidden sm:block w-20 shrink-0">
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${entry.total > 0 ? (entry.completed / entry.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                      {entry.completed}/{entry.total}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AppLayout>
  );
};

export default LeaderboardPage;
