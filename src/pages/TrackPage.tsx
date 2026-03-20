import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { markLessonCompleteDB, getTrackProgressDB, savePartialProgressDB } from "@/lib/progressDB";
import Header from "@/components/Header";
import VideoPlayer from "@/components/VideoPlayer";
import LessonSidebar from "@/components/LessonSidebar";
import LessonNotes from "@/components/LessonNotes";
import LessonMaterials from "@/components/LessonMaterials";
import TrackRating from "@/components/TrackRating";
import LessonForum from "@/components/LessonForum";
import QuizForm from "@/components/QuizForm";
import Certificate from "@/components/Certificate";
import { ArrowLeft, ClipboardCheck, BookOpen, CheckCircle2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useSurveyTrigger } from "@/hooks/useSurveyTrigger";
import SurveyModal from "@/components/SurveyModal";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

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
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const isLessonComplete = (lesson: LessonRow) => {
    const lessonProgress = progress[lesson.id];
    if (!lessonProgress) return false;
    if (lessonProgress.completed) return true;
    const duration = lesson.duration || 0;
    return duration > 0 && lessonProgress.watched_seconds >= duration * 0.9;
  };

  const allLessonsCompletedForSurvey = lessons.length > 0 && lessons.every(isLessonComplete);
  const isFullyComplete = allLessonsCompletedForSurvey && quizPassed;
  const { pendingSurvey, showSurvey, dismissSurvey } = useSurveyTrigger(
    isFullyComplete ? "track_completion" : undefined,
    trackId
  );

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

  useEffect(() => { loadData(); }, [loadData]);

  const currentLesson = lessons.find((l) => l.id === currentLessonId);
  const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
  const allLessonsComplete = lessons.length > 0 && lessons.every(isLessonComplete);
  const completedLessons = lessons.filter(isLessonComplete).length;

  const overallPercent = lessons.length > 0
    ? Math.round(
        lessons.reduce((acc, lesson) => {
          const lp = progress[lesson.id];
          if (!lp) return acc;
          if (isLessonComplete(lesson)) return acc + 100;
          const dur = lesson.duration || 0;
          if (dur <= 0) {
            return acc + (lp.watched_seconds > 0 ? Math.min(lp.watched_seconds / 60 * 10, 90) : 0);
          }
          return acc + Math.min((lp.watched_seconds / dur) * 100, 99);
        }, 0) / lessons.length
      )
    : 0;

  const quiz = quizzes[0];

  const handleLessonComplete = async (watchedSeconds: number) => {
    if (!user || !trackId) return;
    await markLessonCompleteDB(user.id, trackId, currentLessonId, watchedSeconds);
    setProgress((prev) => ({
      ...prev,
      [currentLessonId]: { completed: true, watched_seconds: watchedSeconds },
    }));
  };

  const handleProgress = useCallback(async (watchedSeconds: number) => {
    if (!user || !trackId) return;
    await savePartialProgressDB(user.id, trackId, currentLessonId, watchedSeconds);
    setProgress((prev) => ({
      ...prev,
      [currentLessonId]: {
        completed: prev[currentLessonId]?.completed || false,
        watched_seconds: Math.max(watchedSeconds, prev[currentLessonId]?.watched_seconds || 0),
      },
    }));
  }, [user, trackId, currentLessonId]);

  const handleQuizSubmit = async (score: number, passed: boolean) => {
    if (!user || !quiz) return;
    await supabase.from("quiz_attempts").insert({ user_id: user.id, quiz_id: quiz.id, score, passed });
    setQuizScore(score);
    setQuizPassed(passed);
    if (passed) {
      setCompletedAt(new Date().toISOString());
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

  const lessonSidebarProps = {
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description || "",
      videoUrl: l.video_url || "",
      duration: l.duration || 0,
      order: l.order_index || 0,
    })),
    currentLessonId,
    progress: Object.fromEntries(
      Object.entries(progress).map(([k, v]) => [k, { completed: v.completed, watchedSeconds: v.watched_seconds }])
    ),
    onSelectLesson: (id: string) => { setCurrentLessonId(id); setShowQuiz(false); },
    trackTitle: track?.title,
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen min-h-dvh bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-background">
      <Header />

      {/* ── Track header ── */}
      <div className="border-b border-border/50 bg-card">
        <div className="container py-3 sm:py-4">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <Link to="/dashboard" className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
                <ArrowLeft className="h-3 w-3" />
                <span>Voltar</span>
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] shrink-0">{track.category}</Badge>
                <h1 className="font-display text-sm sm:text-base md:text-xl font-bold text-foreground truncate">{track.title}</h1>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {lessons.length} aulas
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedLessons}/{lessons.length}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden h-9 sm:h-8 gap-1.5 text-xs touch-manipulation"
                onClick={() => setSidebarOpen(true)}
              >
                <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden xs:inline">Aulas</span>
              </Button>
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-display font-extrabold text-gradient-nexti tabular-nums">{overallPercent}%</p>
                <Progress value={overallPercent} className="h-1.5 w-32 mt-1" />
              </div>
            </div>
          </div>

          {/* Mobile/tablet progress */}
          <div className="sm:hidden mt-2 flex items-center gap-2">
            <Progress value={overallPercent} className="h-2 flex-1" />
            <span className="text-xs font-bold text-primary tabular-nums min-w-[2rem] text-right">{overallPercent}%</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="container py-3 sm:py-4 md:py-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
          {/* Left column — video + content */}
          <div className="space-y-3 sm:space-y-4 md:space-y-5 min-w-0">
            <AnimatePresence mode="wait">
              {!showQuiz ? (
                <motion.div
                  key={currentLessonId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 sm:space-y-4 md:space-y-5"
                >
                  {currentLesson && (
                    <>
                      <VideoPlayer
                        videoUrl={currentLesson.video_url || ""}
                        onComplete={handleLessonComplete}
                        onProgress={handleProgress}
                        lessonTitle={currentLesson.title}
                        lessonDuration={currentLesson.duration || 0}
                        initialWatchedSeconds={progress[currentLessonId]?.watched_seconds || 0}
                        onPrev={currentIndex > 0 ? () => goToLesson(currentIndex - 1) : undefined}
                        onNext={currentIndex < lessons.length - 1 ? () => goToLesson(currentIndex + 1) : undefined}
                      />

                      {/* Lesson info + tabs */}
                      <div className="card-surface overflow-hidden">
                        <div className="p-3 sm:p-4 md:p-5 border-b border-border/50">
                          <h2 className="font-display text-sm sm:text-base md:text-lg font-semibold text-foreground">
                            {currentLesson.title}
                          </h2>
                          {currentLesson.description && (
                            <p className="mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-3">{currentLesson.description}</p>
                          )}
                        </div>

                        <Tabs defaultValue="notas" className="w-full">
                          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-2 sm:px-4 md:px-5 h-auto py-0 gap-0">
                            <TabsTrigger value="notas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation">
                              Anotações
                            </TabsTrigger>
                            <TabsTrigger value="materiais" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation">
                              Materiais
                            </TabsTrigger>
                            <TabsTrigger value="forum" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm touch-manipulation">
                              Fórum
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="notas" className="p-3 sm:p-4 md:p-5 mt-0">
                            <LessonNotes lessonId={currentLessonId} />
                          </TabsContent>
                          <TabsContent value="materiais" className="p-3 sm:p-4 md:p-5 mt-0">
                            <LessonMaterials lessonId={currentLessonId} />
                          </TabsContent>
                          <TabsContent value="forum" className="p-3 sm:p-4 md:p-5 mt-0">
                            {trackId && <LessonForum lessonId={currentLessonId} trackId={trackId} />}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </>
                  )}

                  {allLessonsComplete && !quizPassed && quizForForm && (
                    <Button
                      onClick={() => setShowQuiz(true)}
                      className="w-full gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90 h-12 sm:h-12 text-sm touch-manipulation"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Iniciar Avaliação Final
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
                    <QuizForm quiz={quizForForm} onSubmit={handleQuizSubmit} previousScore={quizScore} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {quizPassed && completedAt && (
              <div className="space-y-3 sm:space-y-4">
                <Certificate userName={profileName} trackTitle={track.title} completedAt={completedAt} score={quizScore || 0} />
                <TrackRating trackId={track.id} />
              </div>
            )}

            {pendingSurvey && (
              <SurveyModal
                open={showSurvey}
                onClose={dismissSurvey}
                survey={pendingSurvey}
                context={{ track_id: trackId || "", track_title: track.title }}
              />
            )}
          </div>

          {/* ── Desktop sidebar ── */}
          <div className="hidden lg:block">
            <div className="sticky top-[4.5rem] space-y-4 max-h-[calc(100dvh-6rem)] overflow-y-auto">
              <LessonSidebar {...lessonSidebarProps} />
            </div>
          </div>

          {/* ── Mobile/Tablet sidebar sheet ── */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="right" className="w-[90vw] max-w-md p-0">
              <SheetHeader className="px-4 py-3 border-b border-border/50">
                <SheetTitle className="text-sm font-semibold">Conteúdo da Trilha</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto max-h-[calc(100dvh-4rem)] overscroll-contain">
                <LessonSidebar
                  {...lessonSidebarProps}
                  onSelectLesson={(id) => {
                    setCurrentLessonId(id);
                    setShowQuiz(false);
                    setSidebarOpen(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </main>
    </div>
  );
};

export default TrackPage;
