import { useState } from "react";
import { tracks } from "@/lib/data";
import { getTrackCompletionPercent, getTotalWatchedSeconds, getAverageQuizScore } from "@/lib/progress";
import TrackCard from "@/components/TrackCard";
import Header from "@/components/Header";
import { BookOpen, Clock, Trophy } from "lucide-react";

const Index = () => {
  const [, setRefresh] = useState(0);

  const completedCount = tracks.filter(
    (t) => getTrackCompletionPercent(t.id) === 100
  ).length;
  const totalWatched = getTotalWatchedSeconds();
  const avgScore = getAverageQuizScore();

  const formatHours = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}min`;
    return `${(secs / 3600).toFixed(1)}h`;
  };

  const stats = [
    { icon: BookOpen, label: "Trilhas Concluídas", value: `${completedCount}/${tracks.length}` },
    { icon: Clock, label: "Tempo Assistido", value: formatHours(totalWatched) },
    { icon: Trophy, label: "Nota Média", value: avgScore > 0 ? `${avgScore}%` : "—" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero banner with Nexti gradient */}
      <div className="bg-gradient-nexti">
        <div className="container py-10">
          <h1 className="font-display text-3xl font-extrabold text-primary-foreground">
            Minhas Trilhas
          </h1>
          <p className="mt-2 text-primary-foreground/80">
            Desenvolva suas competências cooperativistas em trilhas estruturadas.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="tabular-nums font-display text-xl font-bold text-primary-foreground">{value}</p>
                  <p className="text-xs text-primary-foreground/70">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="space-y-3">
          {tracks.map((track, i) => (
            <TrackCard key={track.id} track={track} index={i} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
