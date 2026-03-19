import { Check, PlayCircle } from "lucide-react";
import { Lesson } from "@/lib/data";
import { LessonProgress } from "@/lib/progress";
import { motion } from "framer-motion";

interface LessonSidebarProps {
  lessons: Lesson[];
  currentLessonId: string;
  progress: Record<string, LessonProgress>;
  onSelectLesson: (lessonId: string) => void;
}

const LessonSidebar = ({ lessons, currentLessonId, progress, onSelectLesson }: LessonSidebarProps) => {
  const totalLessons = lessons.length;
  const completedLessons = Object.values(progress).filter((p) => p.completed).length;
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="card-surface p-1">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-foreground">Conteúdo</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{completedLessons}/{totalLessons}</span>
        </div>
        {/* Overall progress bar */}
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
          const isActive = lesson.id === currentLessonId;
          const isComplete = progress[lesson.id]?.completed;
          const watchedSecs = progress[lesson.id]?.watchedSeconds || 0;
          const lessonDuration = lesson.duration || 1;
          const watchedPercent = Math.min(100, Math.round((watchedSecs / lessonDuration) * 100));

          return (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                isActive
                  ? "bg-primary/5 text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <div className="shrink-0">
                {isComplete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                  >
                    <Check className="h-4 w-4 text-success" />
                  </motion.div>
                ) : (
                  <PlayCircle className={`h-4 w-4 ${isActive ? "text-accent" : ""}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lesson.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-success" : "bg-primary/50"}`}
                      style={{ width: `${isComplete ? 100 : watchedPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {Math.round(lesson.duration / 60)}min
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
