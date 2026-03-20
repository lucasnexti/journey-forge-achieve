import { Check, PlayCircle, Circle } from "lucide-react";
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

  return (
    <div className="card-surface p-1">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-foreground truncate">{trackTitle || "Conteúdo"}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{completedLessons}/{totalLessons}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${overallPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <div className="space-y-0.5">
        {lessons.map((lesson) => {
          const isCurrent = lesson.id === currentLessonId;
          const done = isLessonDone(lesson);
          const watchedSecs = progress[lesson.id]?.watchedSeconds || 0;
          const lessonDuration = lesson.duration || 1;
          const watchedPercent = Math.min(100, Math.round((watchedSecs / lessonDuration) * 100));

          return (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                isCurrent
                  ? "bg-primary/10 text-foreground"
                  : done
                    ? "text-muted-foreground hover:bg-secondary/50"
                    : "text-foreground hover:bg-secondary/30"
              }`}
            >
              <div className="shrink-0">
                {done ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 dark:bg-green-600"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                ) : isCurrent ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
                    <PlayCircle className="h-3.5 w-3.5 text-primary" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${done ? "line-through opacity-70" : "font-medium"}`}>
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${done ? "bg-green-500 dark:bg-green-600" : "bg-primary/50"}`}
                      style={{ width: `${done ? 100 : watchedPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {lesson.duration > 0 ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, "0")}` : "--:--"}
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
