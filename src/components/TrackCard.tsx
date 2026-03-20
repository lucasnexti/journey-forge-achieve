import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, PlayCircle, Heart, BookOpen, Clock, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TrackCardProps {
  trackId: string;
  title: string;
  description: string;
  category: string;
  totalLessons: number;
  totalDurationSeconds: number;
  index: number;
  isEnrolled: boolean;
  isCompleted: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const TrackCard = ({
  trackId, title, description, category, totalLessons, totalDurationSeconds,
  index, isEnrolled, isCompleted, isFavorite = false, onToggleFavorite,
}: TrackCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [percent, setPercent] = useState(0);
  const [completedLessons, setCompletedLessons] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Fetch lesson progress with watched_seconds AND lesson durations
    const fetchProgress = async () => {
      const [{ data: progressData }, { data: lessonsData }] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed, watched_seconds")
          .eq("user_id", user.id)
          .eq("track_id", trackId),
        supabase
          .from("lessons")
          .select("id, duration")
          .eq("track_id", trackId),
      ]);

      const lessons = lessonsData || [];
      const progressMap = new Map(
        (progressData || []).map((p) => [p.lesson_id, p])
      );

      let totalPercent = 0;
      let completed = 0;

      lessons.forEach((lesson) => {
        const lp = progressMap.get(lesson.id);
        if (!lp) return;
        if (lp.completed) {
          totalPercent += 100;
          completed++;
        } else {
          const dur = lesson.duration || 0;
          const ws = lp.watched_seconds || 0;
          if (dur > 0) {
            totalPercent += Math.min((ws / dur) * 100, 99);
          } else if (ws > 0) {
            totalPercent += Math.min(ws / 60 * 10, 90);
          }
        }
      });

      setCompletedLessons(completed);
      setPercent(lessons.length > 0 ? Math.round(totalPercent / lessons.length) : 0);
    };

    fetchProgress();
  }, [user, trackId]);

  const handleEnroll = async () => {
    if (!user) return;
    await supabase.from("enrollments").upsert(
      { user_id: user.id, track_id: trackId, status: "active" },
      { onConflict: "user_id,track_id" }
    );
    navigate(`/trilha/${trackId}`);
  };

  const categoryColors: Record<string, string> = {
    default: "bg-primary/10 text-primary",
  };
  const catClass = categoryColors[category] || categoryColors.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div
        onClick={() => isEnrolled ? navigate(`/trilha/${trackId}`) : handleEnroll()}
        className="group card-surface-hover flex flex-col h-full cursor-pointer overflow-hidden"
      >
        {/* Top accent */}
        <div className={cn("h-1 w-full", isCompleted ? "bg-success" : isEnrolled ? "bg-primary" : "bg-border")} />

        <div className="flex flex-col flex-1 p-5">
          {/* Category & favorite */}
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className={cn("text-[10px] font-semibold", catClass)}>
              {category || "Geral"}
            </Badge>
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <Heart className={cn("h-4 w-4", isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground")} />
              </button>
            )}
          </div>

          {/* Title & description */}
          <h3 className="font-display text-base font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2 flex-1">{description}</p>

          {/* Meta */}
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totalLessons} aulas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {estimatedHours}h
            </span>
          </div>

          {/* Progress or CTA */}
          <div className="mt-4 pt-4 border-t border-border/50">
            {isCompleted ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Concluída
                </span>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
            ) : isEnrolled ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{completedLessons}/{totalLessons} aulas</span>
                  <span className="font-semibold text-foreground tabular-nums">{percent}%</span>
                </div>
                <Progress value={percent} className="h-1.5" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <PlayCircle className="h-4 w-4" />
                  Começar trilha
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TrackCard;
