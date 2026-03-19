import { Link } from "react-router-dom";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Track } from "@/lib/data";
import { getTrackCompletionPercent, isTrackUnlocked, getTrackProgress } from "@/lib/progress";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import CircularProgress from "./CircularProgress";

interface TrackCardProps {
  track: Track;
  index: number;
}

const TrackCard = ({ track, index }: TrackCardProps) => {
  const unlocked = isTrackUnlocked(track.id);
  const percent = getTrackCompletionPercent(track.id);
  const progress = getTrackProgress(track.id);
  const isComplete = progress.quizPassed;

  if (!unlocked) {
    return (
      <div className="card-surface flex items-center gap-6 p-6 opacity-60">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Trilha {index + 1} · {track.category}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
            {track.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{track.description}</p>
        </div>
        <div className="shrink-0">
          <span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Bloqueada
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/trilha/${track.id}`} className="card-surface-hover flex items-center gap-6 p-6 group">
      <div className="shrink-0">
        <CircularProgress percent={percent} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trilha {index + 1} · {track.category}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
          {track.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{track.description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{track.totalLessons} aulas</span>
          <span>·</span>
          <span>{track.estimatedHours}h estimadas</span>
        </div>
      </div>
      <div className="shrink-0">
        {isComplete ? (
          <span className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluída
          </span>
        ) : (
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        )}
      </div>
    </Link>
  );
};

export default TrackCard;
