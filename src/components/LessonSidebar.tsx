import { Check, PlayCircle, Circle, Clock } from "lucide-react";
import { Lesson } from "@/lib/data";
import { LessonProgress } from "@/lib/progress";
import { motion } from "framer-motion";

interface LessonSidebarProps {
  lessons: Lesson[];
  currentLessonId: string;
  progress: Record<string, LessonProgress>;
  onSelectLesson: (lessonId: string) => void;
  trackTitle?: string;
}

const LessonSidebar = ({ lessons, currentLessonId, progress, onSelectLesson, trackTitle }: LessonSidebarProps) => {
  const totalLessons = lessons.length;

  const isLessonDone = (lesson: Lesson) => {
    const lp = progress[lesson.id];
    if (!lp) return false;
    if (lp.completed) return true;
    const dur = lesson.duration || 0;
    return dur > 0 && (lp.watchedSeconds || 0) >= dur * 0.9;
  };

  const completedLessons = lessons.filter(isLessonDone).length;
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const formatDuration = (secs: number) => {
    if (secs <= 0) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="card-surface p-1">
      {/* Header */}
      <div className="px-4 py-3 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-foreground truncate">{trackTitle || "Conteúdo"}</h3>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{completedLessons}/{totalLessons}</span>
        </div>
        <div className="mt-2 h-2 sm:h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${overallPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground text-right tabular-nums">{overallPercent}% concluído</p>
      </div>

      {/* Lesson list */}
      <div className="space-y-0.5 pb-1">
        {lessons.map((lesson, index) => {
          const isCurrent = lesson.id === currentLessonId;
          const done = isLessonDone(lesson);
          const watchedSecs = progress[lesson.id]?.watchedSeconds || 0;
          const lessonDuration = lesson.duration || 1;
          const watchedPercent = Math.min(100, Math.round((watchedSecs / lessonDuration) * 100));

          return (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 sm:px-4 py-3.5 sm:py-3 text-left transition-colors active:bg-secondary/60 touch-manipulation ${
                isCurrent
                  ? "bg-primary/10 text-foreground"
                  : done
                    ? "text-muted-foreground hover:bg-secondary/50"
                    : "text-foreground hover:bg-secondary/30"
              }`}
            >
              {/* Step indicator */}
              <div className="shrink-0 mt-0.5">
                {done ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    className="flex h-6 w-6 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-green-500 dark:bg-green-600"
                  >
                    <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-white" />
                  </motion.div>
                ) : isCurrent ? (
                  <div className="flex h-6 w-6 sm:h-5 sm:w-5 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
                    <PlayCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-primary" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 sm:h-5 sm:w-5 items-center justify-center">
                    <span className="text-xs text-muted-foreground/60 font-medium">{index + 1}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${done ? "line-through opacity-60" : isCurrent ? "font-semibold" : "font-medium"}`}>
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 sm:h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${done ? "bg-green-500 dark:bg-green-600" : "bg-primary/50"}`}
                      style={{ width: `${done ? 100 : watchedPercent}%` }}
                    />
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDuration(lesson.duration)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LessonSidebar;
