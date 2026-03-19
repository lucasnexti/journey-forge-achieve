import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { tracks } from "@/lib/data";
import { getTrackProgress, markLessonComplete, saveQuizResult } from "@/lib/progress";
import Header from "@/components/Header";
import VideoPlayer from "@/components/VideoPlayer";
import LessonSidebar from "@/components/LessonSidebar";
import QuizForm from "@/components/QuizForm";
import Certificate from "@/components/Certificate";
import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const TrackPage = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const track = tracks.find((t) => t.id === trackId);

  const [progress, setProgress] = useState(() => getTrackProgress(trackId || ""));
  const [currentLessonId, setCurrentLessonId] = useState(track?.lessons[0]?.id || "");
  const [showQuiz, setShowQuiz] = useState(false);

  const currentLesson = track?.lessons.find((l) => l.id === currentLessonId);
  const allLessonsComplete = track ? track.lessons.every((l) => progress.lessons[l.id]?.completed) : false;

  const refreshProgress = useCallback(() => {
    setProgress(getTrackProgress(trackId || ""));
  }, [trackId]);

  const handleLessonComplete = (watchedSeconds: number) => {
    markLessonComplete(trackId || "", currentLessonId, watchedSeconds);
    refreshProgress();
  };

  const handleQuizSubmit = (score: number, passed: boolean) => {
    saveQuizResult(trackId || "", score, passed);
    refreshProgress();
  };

  if (!track) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-accent underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const nextTrack = track.nextTrackId ? tracks.find((t) => t.id === track.nextTrackId) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar às trilhas
        </Link>

        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{track.category}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-foreground">{track.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{track.description}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {!showQuiz ? (
                <motion.div
                  key={currentLessonId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentLesson && (
                    <>
                      <VideoPlayer
                        videoUrl={currentLesson.videoUrl}
                        onComplete={handleLessonComplete}
                        lessonTitle={currentLesson.title}
                      />
                      <div className="card-surface p-5">
                        <h2 className="font-display text-lg font-semibold text-foreground">
                          {currentLesson.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">{currentLesson.description}</p>
                      </div>
                    </>
                  )}

                  {allLessonsComplete && !progress.quizPassed && (
                    <Button
                      onClick={() => setShowQuiz(true)}
                      className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Iniciar Avaliação
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="quiz"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <QuizForm
                    quiz={track.quiz}
                    onSubmit={handleQuizSubmit}
                    previousScore={progress.quizScore}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {progress.quizPassed && progress.completedAt && (
              <div className="space-y-4">
                <Certificate
                  userName="Cooperado(a)"
                  trackTitle={track.title}
                  completedAt={progress.completedAt}
                  score={progress.quizScore || 0}
                />

                {nextTrack && (
                  <Button
                    onClick={() => navigate(`/trilha/${nextTrack.id}`)}
                    className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Próxima Trilha: {nextTrack.title}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <LessonSidebar
              lessons={track.lessons}
              currentLessonId={currentLessonId}
              progress={progress.lessons}
              onSelectLesson={(id) => {
                setCurrentLessonId(id);
                setShowQuiz(false);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrackPage;
