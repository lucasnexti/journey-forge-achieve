import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { getUserStats, getLastWatchedLesson } from "@/lib/progressDB";
import { getUserGamificationData, updateStreak, getLevelInfo } from "@/lib/gamification";
import AppLayout from "@/components/AppLayout";
import TrackCard from "@/components/TrackCard";
import OnboardingWizard from "@/components/OnboardingWizard";
import { BookOpen, Clock, Trophy, Play, Search, Heart, TrendingUp, Target, Award, Coins, Flame, ArrowRight, Sparkles } from "lucide-react";
import LinkedInShare from "@/components/LinkedInShare";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TrackRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  estimated_hours: number | null;
  is_active: boolean | null;
  order_index: number | null;
  lessons: { id: string; duration: number | null }[];
  enrollments: { id: string; status: string | null }[];
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [stats, setStats] = useState({ enrollments: 0, totalWatched: 0, avgScore: 0 });
  const [lastLesson, setLastLesson] = useState<Awaited<ReturnType<typeof getLastWatchedLesson>>>(null);
  const [gamification, setGamification] = useState({ coins: 0, xp: 0, level: 1, streak: 0, longestStreak: 0 });
  const [badges, setBadges] = useState<{ name: string; icon: string; earned: boolean }[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: trackData }, statsData, lastData, { data: userBadges }, { data: allBadges }, { data: profileData }, { data: favData }, gData, { data: lessonProgressData }] = await Promise.all([
        supabase
          .from("tracks")
          .select("id, title, description, category, estimated_hours, is_active, order_index, lessons(id, duration), enrollments(id, status)")
          .eq("is_active", true)
          .order("order_index"),
        getUserStats(user.id),
        getLastWatchedLesson(user.id),
        supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
        supabase.from("badges").select("id, name, icon"),
        supabase.from("profiles").select("nome, onboarding_completed").eq("user_id", user.id).maybeSingle(),
        supabase.from("track_favorites").select("track_id").eq("user_id", user.id),
        getUserGamificationData(user.id),
        supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", user.id).eq("completed", true),
      ]);

      setTracks((trackData as unknown as TrackRow[]) || []);
      setStats(statsData);
      setLastLesson(lastData);
      setGamification(gData);
      setCompletedLessonIds(new Set((lessonProgressData || []).map((lp: any) => lp.lesson_id)));

      const earnedSet = new Set((userBadges || []).map((b: any) => b.badge_id));
      setBadges((allBadges || []).map((b: any) => ({ name: b.name, icon: b.icon || "award", earned: earnedSet.has(b.id) })));

      if (profileData) {
        setProfileName(profileData.nome || "");
        if (!profileData.onboarding_completed) setShowOnboarding(true);
      }

      setFavorites(new Set((favData || []).map((f: any) => f.track_id)));
      setLoading(false);

      updateStreak(user.id).catch(() => {});
    };
    load();
  }, [user]);

  const categories = [...new Set(tracks.map((t) => t.category).filter(Boolean))] as string[];

  const filtered = tracks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || t.category === categoryFilter;
    const matchFavorite = !showFavoritesOnly || favorites.has(t.id);
    return matchSearch && matchCategory && matchFavorite;
  });

  const toggleFavorite = async (trackId: string) => {
    if (!user) return;
    if (favorites.has(trackId)) {
      await supabase.from("track_favorites").delete().eq("user_id", user.id).eq("track_id", trackId);
      setFavorites((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
    } else {
      await supabase.from("track_favorites").insert({ user_id: user.id, track_id: trackId });
      setFavorites((prev) => new Set(prev).add(trackId));
    }
  };

  const completedCount = tracks.filter((t) => t.enrollments?.some((e) => e.status === "completed")).length;
  const enrolledTracks = tracks.filter((t) => t.enrollments?.length > 0 && !t.enrollments?.some((e) => e.status === "completed"));
  const notStartedTracks = tracks.filter((t) => !t.enrollments || t.enrollments.length === 0);
  const completedTracks = tracks.filter((t) => t.enrollments?.some((e) => e.status === "completed"));
  const overallProgress = tracks.length > 0 ? Math.round((completedCount / tracks.length) * 100) : 0;

  const formatTime = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}min`;
    return `${(secs / 3600).toFixed(1)}h`;
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const levelInfo = getLevelInfo(gamification.xp);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary-foreground">
                {greeting()}{profileName ? `, ${profileName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {completedCount === 0
                  ? "Comece sua jornada de aprendizado explorando as trilhas disponíveis."
                  : `Você completou ${completedCount} de ${tracks.length} trilhas. Continue assim!`}
              </p>
            </motion.div>

            {/* Stats pills */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <Link to="/loja" className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5 hover:bg-white/20 transition-colors">
                <Coins className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{gamification.coins.toLocaleString("pt-BR")}</span>
              </Link>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <Flame className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground tabular-nums">{gamification.streak}d</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground">Nv.{levelInfo.level}</span>
              </div>
            </motion.div>
          </div>

          {/* Progress bar in hero */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-5 flex items-center gap-3"
          >
            <div className="flex-1">
              <Progress value={overallProgress} className="h-2 bg-white/20 [&>div]:bg-white" />
            </div>
            <span className="text-sm font-bold text-primary-foreground tabular-nums">{overallProgress}%</span>
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Continue Learning — prominent card */}
        {lastLesson && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <button
              onClick={() => navigate(`/trilha/${lastLesson.track_id}`)}
              className="w-full card-surface-hover flex items-center gap-4 p-4 sm:p-5 text-left group"
            >
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-nexti shadow-lg shadow-primary/20">
                <Play className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-0.5">
                  Continuar aprendendo
                </p>
                <p className="font-display text-sm sm:text-base font-semibold text-foreground truncate">
                  {lastLesson.lesson_title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{lastLesson.track_title}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        )}

        {/* Quick stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            { icon: Target, label: "Progresso", value: `${overallProgress}%`, color: "text-primary" },
            { icon: BookOpen, label: "Concluídas", value: `${completedCount}/${tracks.length}`, color: "text-success" },
            { icon: Clock, label: "Tempo", value: formatTime(stats.totalWatched), color: "text-muted-foreground" },
            { icon: Trophy, label: "Nota Média", value: stats.avgScore > 0 ? `${stats.avgScore}%` : "—", color: "text-warning" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card-surface p-3 sm:p-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold tabular-nums text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>


        {/* Search & Filters */}
        <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={categoryFilter === null && !showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setCategoryFilter(null); setShowFavoritesOnly(false); }}
              className={categoryFilter === null && !showFavoritesOnly ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-7 text-xs" : "h-7 text-xs"}
            >
              Todas
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => { setCategoryFilter(cat); setShowFavoritesOnly(false); }}
                className={categoryFilter === cat ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-7 text-xs" : "h-7 text-xs"}
              >
                {cat}
              </Button>
            ))}
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCategoryFilter(null); }}
              className={showFavoritesOnly ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-7 text-xs" : "h-7 text-xs"}
            >
              <Heart className="h-3 w-3 mr-1" />
              Favoritas
            </Button>
          </div>
        </div>

        {/* Tracks by section */}
        {search || categoryFilter || showFavoritesOnly ? (
          // Filtered view
          filtered.length === 0 ? (
            <div className="card-surface p-12 text-center text-muted-foreground">
              Nenhuma trilha encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((track, i) => (
                <TrackCard
                  key={track.id}
                  trackId={track.id}
                  title={track.title}
                  description={track.description || ""}
                  category={track.category || ""}
                  totalLessons={track.lessons?.length || 0}
                  totalDurationSeconds={track.lessons?.reduce((sum, l) => sum + (l.duration || 0), 0) || 0}
                  index={i}
                  isEnrolled={track.enrollments?.length > 0}
                  isCompleted={track.enrollments?.some((e) => e.status === "completed") || false}
                  isFavorite={favorites.has(track.id)}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                />
              ))}
            </div>
          )
        ) : (
          // Sectioned view
          <div className="space-y-8">
            {/* In Progress */}
            {enrolledTracks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Play className="h-3 w-3 text-primary" />
                  </div>
                  <h2 className="font-display text-base font-bold text-foreground">Em andamento</h2>
                  <Badge variant="secondary" className="text-[10px]">{enrolledTracks.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {enrolledTracks.map((track, i) => (
                    <TrackCard
                      key={track.id}
                      trackId={track.id}
                      title={track.title}
                      description={track.description || ""}
                      category={track.category || ""}
                      totalLessons={track.lessons?.length || 0}
                      totalDurationSeconds={track.lessons?.reduce((sum, l) => sum + (l.duration || 0), 0) || 0}
                      index={i}
                      isEnrolled
                      isCompleted={false}
                      isFavorite={favorites.has(track.id)}
                      onToggleFavorite={() => toggleFavorite(track.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Available */}
            {notStartedTracks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <h2 className="font-display text-base font-bold text-foreground">Disponíveis</h2>
                  <Badge variant="secondary" className="text-[10px]">{notStartedTracks.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {notStartedTracks.map((track, i) => (
                    <TrackCard
                      key={track.id}
                      trackId={track.id}
                      title={track.title}
                      description={track.description || ""}
                      category={track.category || ""}
                      totalLessons={track.lessons?.length || 0}
                      totalDurationSeconds={track.lessons?.reduce((sum, l) => sum + (l.duration || 0), 0) || 0}
                      index={i}
                      isEnrolled={false}
                      isCompleted={false}
                      isFavorite={favorites.has(track.id)}
                      onToggleFavorite={() => toggleFavorite(track.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completedTracks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-6 rounded-lg bg-success/10 flex items-center justify-center">
                    <Trophy className="h-3 w-3 text-success" />
                  </div>
                  <h2 className="font-display text-base font-bold text-foreground">Concluídas</h2>
                  <Badge variant="secondary" className="text-[10px]">{completedTracks.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {completedTracks.map((track, i) => (
                    <TrackCard
                      key={track.id}
                      trackId={track.id}
                      title={track.title}
                      description={track.description || ""}
                      category={track.category || ""}
                      totalLessons={track.lessons?.length || 0}
                      totalDurationSeconds={track.lessons?.reduce((sum, l) => sum + (l.duration || 0), 0) || 0}
                      index={i}
                      isEnrolled
                      isCompleted
                      isFavorite={favorites.has(track.id)}
                      onToggleFavorite={() => toggleFavorite(track.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
