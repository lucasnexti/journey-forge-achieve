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
  return (
    <div className="card-surface p-1">
      <div className="px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Conteúdo</h3>
      </div>
      <div className="space-y-0.5">
        {lessons.map((lesson) => {
          const isActive = lesson.id === currentLessonId;
          const isComplete = progress[lesson.id]?.completed;

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
                <p className="text-xs text-muted-foreground">
                  {Math.round(lesson.duration / 60)} min
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LessonSidebar;
