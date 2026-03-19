import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import CircularProgress from "./CircularProgress";

interface TrackCardProps {
  trackId: string;
  title: string;
  description: string;
  category: string;
  totalLessons: number;
  estimatedHours: number;
  index: number;
  isEnrolled: boolean;
  isCompleted: boolean;
}

const TrackCard = ({
  trackId,
  title,
  description,
  category,
  totalLessons,
  estimatedHours,
  index,
  isEnrolled,
  isCompleted,
}: TrackCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completedLessons, setCompletedLessons] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("track_id", trackId)
      .eq("completed", true)
      .then(({ count }) => setCompletedLessons(count || 0));
  }, [user, trackId]);

  const percent = totalLessons > 0
    ? Math.round(((completedLessons / totalLessons) * 80) + (isCompleted ? 20 : 0))
    : 0;

  const handleEnroll = async () => {
    if (!user) return;
    await supabase.from("enrollments").upsert(
      { user_id: user.id, track_id: trackId, status: "active" },
      { onConflict: "user_id,track_id" }
    );
    navigate(`/trilha/${trackId}`);
  };

  return (
    <div
      onClick={() => isEnrolled ? navigate(`/trilha/${trackId}`) : handleEnroll()}
      className="card-surface-hover flex items-center gap-6 p-6 group cursor-pointer"
    >
      <div className="shrink-0">
        {isEnrolled ? (
          <CircularProgress percent={percent} />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <PlayCircle className="h-6 w-6 text-primary" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trilha {index + 1} · {category}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{totalLessons} aulas</span>
          <span>·</span>
          <span>{estimatedHours}h estimadas</span>
          {isEnrolled && completedLessons > 0 && (
            <>
              <span>·</span>
              <span className="text-primary font-medium">{completedLessons}/{totalLessons} concluídas</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {isCompleted ? (
          <span className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluída
          </span>
        ) : !isEnrolled ? (
          <span className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Iniciar
          </span>
        ) : (
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        )}
      </div>
    </div>
  );
};

export default TrackCard;
