import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { markLessonCompleteDB, getTrackProgressDB } from "@/lib/progressDB";
import Header from "@/components/Header";
import VideoPlayer from "@/components/VideoPlayer";
import LessonSidebar from "@/components/LessonSidebar";
import LessonNotes from "@/components/LessonNotes";
import LessonMaterials from "@/components/LessonMaterials";
import TrackRating from "@/components/TrackRating";
import LessonForum from "@/components/LessonForum";
import QuizForm from "@/components/QuizForm";
import Certificate from "@/components/Certificate";
import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration: number | null;
  order_index: number | null;
}

interface QuizRow {
  id: string;
  title: string;
  passing_score: number | null;
  quiz_questions: { id: string; question: string; options: any; correct_answer: number; order_index: number | null }[];
}

const TrackPage = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [track, setTrack] = useState<{ id: string; title: string; description: string; category: string } | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [progress, setProgress] = useState<Record<string, { completed: boolean; watched_seconds: number }>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("Cooperado(a)");

  const loadData = useCallback(async () => {
    if (!trackId || !user) return;

    const [{ data: trackData }, { data: lessonData }, { data: quizData }, progressData, { data: profile }] = await Promise.all([
      supabase.from("tracks").select("id, title, description, category").eq("id", trackId).maybeSingle(),
      supabase.from("lessons").select("id, title, description, video_url, duration, order_index").eq("track_id", trackId).order("order_index"),
      supabase.from("quizzes").select("id, title, passing_score, quiz_questions(id, question, options, correct_answer, order_index)").eq("track_id", trackId),
      getTrackProgressDB(user.id, trackId),
      supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle(),
    ]);

    setTrack(trackData ? { ...trackData, description: trackData.description || "", category: trackData.category || "" } : null);
    setLessons(lessonData || []);
    setQuizzes((quizData as unknown as QuizRow[]) || []);
    setProgress(progressData.lessons);
    setQuizScore(progressData.quizScore);
    setQuizPassed(progressData.quizPassed);
    setCompletedAt(progressData.completedAt);
    setProfileName(profile?.nome || "Cooperado(a)");

    if (lessonData && lessonData.length > 0) {
      setCurrentLessonId(lessonData[0].id);
    }

    setLoading(false);
  }, [trackId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentLesson = lessons.find((l) => l.id === currentLessonId);
  const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
  const allLessonsComplete = lessons.length > 0 && lessons.every((l) => progress[l.id]?.completed);
  const quiz = quizzes[0]; // primary quiz

  const handleLessonComplete = async (watchedSeconds: number) => {
    if (!user || !trackId) return;
    await markLessonCompleteDB(user.id, trackId, currentLessonId, watchedSeconds);
    setProgress((prev) => ({
      ...prev,
      [currentLessonId]: { completed: true, watched_seconds: watchedSeconds },
    }));
  };

  const handleQuizSubmit = async (score: number, passed: boolean) => {
    if (!user || !quiz) return;
    await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      score,
      passed,
    });
    setQuizScore(score);
    setQuizPassed(passed);
    if (passed) {
      setCompletedAt(new Date().toISOString());
      // Update enrollment
      await supabase
        .from("enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("track_id", trackId);
      toast.success("Parabéns! Trilha concluída!");
    }
  };

  const goToLesson = (index: number) => {
    if (index >= 0 && index < lessons.length) {
      setCurrentLessonId(lessons[index].id);
      setShowQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  // Build quiz in the format QuizForm expects
  const quizForForm = quiz
    ? {
        passingScore: quiz.passing_score || 70,
        questions: quiz.quiz_questions
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
          .map((q) => ({
            id: q.id,
            text: q.question,
            options: Array.isArray(q.options) ? q.options as string[] : [],
            correctIndex: q.correct_answer,
          })),
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="bg-gradient-nexti">
        <div className="container py-6">
          <Link to="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar às trilhas
          </Link>
          <p className="text-xs font-bold uppercase tracking-wider text-primary-foreground/70">{track.category}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-primary-foreground">{track.title}</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">{track.description}</p>
        </div>
      </div>

      <main className="container py-6">
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
                        videoUrl={currentLesson.video_url || ""}
                        onComplete={handleLessonComplete}
                        lessonTitle={currentLesson.title}
                        onPrev={currentIndex > 0 ? () => goToLesson(currentIndex - 1) : undefined}
                        onNext={currentIndex < lessons.length - 1 ? () => goToLesson(currentIndex + 1) : undefined}
                      />
                      <div className="card-surface p-5">
                        <h2 className="font-display text-lg font-semibold text-foreground">
                          {currentLesson.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">{currentLesson.description}</p>
                      </div>

                      {/* Notes & Materials */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <LessonNotes lessonId={currentLessonId} />
                        <LessonMaterials lessonId={currentLessonId} />
                      </div>
                    </>
                  )}

                  {allLessonsComplete && !quizPassed && quizForForm && (
                    <Button
                      onClick={() => setShowQuiz(true)}
                      className="w-full gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90"
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
                  {quizForForm && (
                    <QuizForm
                      quiz={quizForForm}
                      onSubmit={handleQuizSubmit}
                      previousScore={quizScore}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {quizPassed && completedAt && (
              <div className="space-y-4">
                <Certificate
                  userName={profileName}
                  trackTitle={track.title}
                  completedAt={completedAt}
                  score={quizScore || 0}
                />
                <TrackRating trackId={track.id} />
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <LessonSidebar
              lessons={lessons.map((l) => ({
                id: l.id,
                title: l.title,
                description: l.description || "",
                videoUrl: l.video_url || "",
                duration: l.duration || 0,
                order: l.order_index || 0,
              }))}
              currentLessonId={currentLessonId}
              progress={Object.fromEntries(
                Object.entries(progress).map(([k, v]) => [k, { completed: v.completed, watchedSeconds: v.watched_seconds }])
              )}
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
