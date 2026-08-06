import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { markLessonCompleteDB, getTrackProgressDB, savePartialProgressDB } from "@/lib/progressDB";
import { awardCoins, COIN_REWARDS } from "@/lib/gamification";
import { triggerAchievement } from "@/components/AchievementPopup";
import AppLayout from "@/components/AppLayout";
import VideoPlayer from "@/components/VideoPlayer";
import LessonSidebar from "@/components/LessonSidebar";
import LessonNotes from "@/components/LessonNotes";
import LessonMaterials from "@/components/LessonMaterials";
import TrackRating from "@/components/TrackRating";
import LessonForum from "@/components/LessonForum";
import ExamRunner, { ExamResult } from "@/components/exam/ExamRunner";
import Certificate from "@/components/Certificate";
import { ArrowLeft, ClipboardCheck, BookOpen, CheckCircle2, List, ChevronLeft, ChevronRight } from "lucide-react";
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


const TrackPage = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [track, setTrack] = useState<{ id: string; title: string; description: string; category: string } | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  
  const [currentLessonId, setCurrentLessonId] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [progress, setProgress] = useState<Record<string, { completed: boolean; watched_seconds: number }>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("Cooperado(a)");
  const [hasExam, setHasExam] = useState(false);

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
    const [{ data: trackData }, { data: lessonData }, { data: examData }, { data: examAttempts }, progressData, { data: profile }] = await Promise.all([
      supabase.from("tracks").select("id, title, description, category").eq("id", trackId).maybeSingle(),
      supabase.from("lessons").select("id, title, description, video_url, duration, order_index").eq("track_id", trackId).order("order_index"),
      supabase.from("exams").select("id").eq("track_id", trackId).eq("is_active", true).maybeSingle(),
      supabase.from("exam_attempts").select("percent, passed, created_at").eq("user_id", user.id).eq("track_id", trackId).order("created_at", { ascending: false }).limit(20),
      getTrackProgressDB(user.id, trackId),
      supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle(),
    ]);
    setTrack(trackData ? { ...trackData, description: trackData.description || "", category: trackData.category || "" } : null);
    setLessons(lessonData || []);
    setHasExam(!!examData);
    setProgress(progressData.lessons);
    setProfileName(profile?.nome || "Cooperado(a)");

    const approved = (examAttempts || []).find((a) => a.passed);
    const last = (examAttempts || [])[0];
    setQuizPassed(!!approved);
    setQuizScore(approved ? Number(approved.percent) : last ? Number(last.percent) : null);
    setCompletedAt(approved ? approved.created_at : null);

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
          if (dur <= 0) return acc + (lp.watched_seconds > 0 ? Math.min(lp.watched_seconds / 60 * 10, 90) : 0);
          return acc + Math.min((lp.watched_seconds / dur) * 100, 99);
        }, 0) / lessons.length
      )
    : 0;

  const quiz = quizzes[0];

  const handleLessonComplete = async (watchedSeconds: number) => {
    if (!user || !trackId) return;
    setProgress((prev) => ({
      ...prev,
      [currentLessonId]: { completed: true, watched_seconds: watchedSeconds },
    }));
    markLessonCompleteDB(user.id, trackId, currentLessonId, watchedSeconds).catch(console.error);
    awardCoins(user.id, COIN_REWARDS.lesson_complete, "Aula concluída", "lesson", currentLessonId).catch(console.error);

    triggerAchievement({
      type: "coins",
      title: "Aula concluída!",
      description: `+${COIN_REWARDS.lesson_complete} Nexti Coins`,
      value: COIN_REWARDS.lesson_complete,
    });
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

  const handleExamFinished = async (result: ExamResult) => {
    if (!user || !trackId) return;
    setQuizScore(result.percent);

    if (result.passed) {
      setQuizPassed(true);
      setCompletedAt(new Date().toISOString());
      const coinAmount = result.percent === 100 ? COIN_REWARDS.quiz_perfect : COIN_REWARDS.quiz_pass;
      awardCoins(user.id, coinAmount, result.percent === 100 ? "Avaliação nota máxima" : "Avaliação aprovada", "exam", trackId).catch(console.error);
      awardCoins(user.id, COIN_REWARDS.track_complete, "Trilha concluída", "track", trackId).catch(console.error);

      triggerAchievement({
        type: "track_complete",
        title: "Trilha concluída! 🎉",
        description: `${track?.title} — Parabéns!`,
        value: COIN_REWARDS.track_complete,
      });
      toast.success("Aprovado! Certificado liberado. 🪙 Moedas adicionadas!");
    } else {
      setQuizPassed(false);
      setCompletedAt(null);
      setProgress({});
      toast.error("Reprovado. Seu progresso foi reiniciado — refaça as aulas para nova tentativa.");
    }
  };

  const goToLesson = (index: number) => {
    if (index >= 0 && index < lessons.length) {
      setCurrentLessonId(lessons[index].id);
      setShowQuiz(false);
    }
  };


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
      <AppLayout fullWidth>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!track) {
    return (
      <AppLayout fullWidth>
        <div className="py-16 text-center px-4">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary underline">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      {/* ── Fixed progress bar at top ── */}
      <div className="sticky top-12 z-30 bg-card/90 backdrop-blur-md border-b border-border/50">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Link to="/dashboard" className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="text-[10px] shrink-0">{track.category}</Badge>
            <h1 className="font-display text-sm font-bold text-foreground truncate">{track.title}</h1>
          </div>

          <div className="flex-1 flex items-center gap-2 ml-2">
            <Progress value={overallPercent} className="h-1.5 flex-1" />
            <span className="text-xs font-bold text-primary tabular-nums shrink-0">{overallPercent}%</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {completedLessons}/{lessons.length} aulas
            </span>
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hidden lg:flex"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden h-8 gap-1.5 text-xs"
              onClick={() => setSidebarOpen(true)}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Aulas</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Cinema layout ── */}
      <div className="flex flex-1">
        {/* Main content */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${!sidebarCollapsed && !isMobile ? 'lg:mr-0' : ''}`}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {!showQuiz ? (
                <motion.div
                  key={currentLessonId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 sm:space-y-5"
                >
                  {currentLesson && (
                    <>
                      {/* Widescreen video */}
                      <div className="rounded-xl overflow-hidden shadow-lg">
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
                      </div>

                      {/* Lesson title + navigation */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
                            {currentLesson.title}
                          </h2>
                          {currentLesson.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{currentLesson.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentIndex <= 0}
                            onClick={() => goToLesson(currentIndex - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground px-1 tabular-nums">
                            {currentIndex + 1}/{lessons.length}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentIndex >= lessons.length - 1}
                            onClick={() => goToLesson(currentIndex + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="card-surface overflow-hidden">
                        <Tabs defaultValue="notas" className="w-full">
                          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-4 h-auto py-0 gap-0">
                            <TabsTrigger value="notas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-sm">
                              Anotações
                            </TabsTrigger>
                            <TabsTrigger value="materiais" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-sm">
                              Materiais
                            </TabsTrigger>
                            <TabsTrigger value="forum" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-sm">
                              Fórum
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="notas" className="p-4 sm:p-5 mt-0">
                            <LessonNotes lessonId={currentLessonId} currentTime={0} />
                          </TabsContent>
                          <TabsContent value="materiais" className="p-4 sm:p-5 mt-0">
                            <LessonMaterials lessonId={currentLessonId} />
                          </TabsContent>
                          <TabsContent value="forum" className="p-4 sm:p-5 mt-0">
                            {trackId && <LessonForum lessonId={currentLessonId} trackId={trackId} />}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </>
                  )}

                  {hasExam && !quizPassed && (
                    <Button
                      onClick={() => setShowQuiz(true)}
                      disabled={!allLessonsComplete}
                      className="w-full gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90 h-12 text-sm"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      {allLessonsComplete
                        ? "Realizar Avaliação Final"
                        : `Avaliação bloqueada — ${completedLessons}/${lessons.length} aulas concluídas`}
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
                  {trackId && (
                    <ExamRunner
                      trackId={trackId}
                      locked={!allLessonsComplete}
                      lockedReason={`Conclua 100% das aulas (${completedLessons}/${lessons.length}) para liberar a avaliação.`}
                      onFinished={handleExamFinished}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {quizPassed && completedAt && (
              <div className="space-y-4 mt-5">
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
        </div>

        {/* ── Desktop sidebar — collapsible ── */}
        <div
          className={`hidden lg:block border-l border-border/50 bg-card/50 transition-all duration-300 overflow-hidden ${
            sidebarCollapsed ? "w-0" : "w-[320px] xl:w-[360px]"
          }`}
        >
          <div className="sticky top-[7rem] h-[calc(100dvh-7rem)] overflow-y-auto">
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
    </AppLayout>
  );
};

export default TrackPage;
