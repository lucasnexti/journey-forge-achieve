import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { getUserStats, getLastWatchedLesson } from "@/lib/progressDB";
import Header from "@/components/Header";
import TrackCard from "@/components/TrackCard";
import OnboardingWizard from "@/components/OnboardingWizard";
import { BookOpen, Clock, Trophy, Play, Search, Filter, Star, Heart, TrendingUp, Target, Award } from "lucide-react";
import LinkedInShare from "@/components/LinkedInShare";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useSurveyTrigger } from "@/hooks/useSurveyTrigger";
import SurveyModal from "@/components/SurveyModal";
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
  lessons: { id: string }[];
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
  const [badges, setBadges] = useState<{ name: string; icon: string; earned: boolean }[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { pendingSurvey, showSurvey, dismissSurvey } = useSurveyTrigger("periodic");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: trackData }, statsData, lastData, { data: userBadges }, { data: allBadges }, { data: profileData }, { data: favData }] = await Promise.all([
        supabase
          .from("tracks")
          .select("id, title, description, category, estimated_hours, is_active, order_index, lessons(id), enrollments(id, status)")
          .eq("is_active", true)
          .order("order_index"),
        getUserStats(user.id),
        getLastWatchedLesson(user.id),
        supabase.from("user_badges").select("badges(name, icon)").eq("user_id", user.id),
        supabase.from("badges").select("name, icon, description, criteria_type, criteria_value"),
        supabase.from("profiles").select("onboarding_completed, nome").eq("user_id", user.id).maybeSingle(),
        supabase.from("track_favorites").select("track_id").eq("user_id", user.id),
      ]);

      setTracks((trackData as unknown as TrackRow[]) || []);
      setStats(statsData);
      setLastLesson(lastData);

      const earnedNames = new Set((userBadges || []).map((ub: any) => ub.badges?.name));
      setBadges(
        (allBadges || []).map((b: any) => ({
          name: b.name || "",
          icon: b.icon || "award",
          earned: earnedNames.has(b.name),
        }))
      );
      setFavorites(new Set((favData || []).map((f: any) => f.track_id)));
      setProfileName(profileData?.nome?.split(" ")[0] || "");

      if (profileData && !profileData.onboarding_completed) {
        setShowOnboarding(true);
      }

      setLoading(false);
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
  const enrolledCount = tracks.filter((t) => t.enrollments?.length > 0).length;
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

  return (
    <div className="min-h-screen bg-background">
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <Header />

      <div className="container py-8">
        {/* Welcome & Continue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Welcome card */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                {greeting()}{profileName ? `, ${profileName}` : ""} 👋
              </h1>
              <p className="mt-1 text-muted-foreground">
                {completedCount === 0
                  ? "Comece sua jornada de aprendizado explorando as trilhas disponíveis."
                  : `Você completou ${completedCount} de ${tracks.length} trilhas. Continue assim!`}
              </p>
            </motion.div>

            {/* Continue learning */}
            {lastLesson && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
                <button
                  onClick={() => navigate(`/trilha/${lastLesson.track_id}`)}
                  className="w-full card-surface-hover flex items-center gap-4 p-4 text-left group"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-nexti shadow-md shadow-primary/20">
                    <Play className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Continuar aprendendo
                    </p>
                    <p className="mt-0.5 font-display text-sm font-semibold text-foreground truncate">
                      {lastLesson.lesson_title}
                    </p>
                    <p className="text-xs text-muted-foreground">{lastLesson.track_title}</p>
                  </div>
                  <Play className="h-4 w-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Stats card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card-surface p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Meu Progresso
              </h3>
              <span className="text-2xl font-display font-extrabold text-gradient-nexti">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2 mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: BookOpen, label: "Concluídas", value: `${completedCount}/${tracks.length}` },
                { icon: Clock, label: "Assistido", value: formatTime(stats.totalWatched) },
                { icon: Trophy, label: "Nota Média", value: stats.avgScore > 0 ? `${stats.avgScore}%` : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                  <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Gamification — Insígnias */}
        {badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Award className="h-4 w-4 text-warning" />
                Insígnias
              </h3>
              <p className="text-xs text-muted-foreground">
                {badges.filter(b => b.earned).length}/{badges.length}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {badges.map((badge, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 shrink-0 rounded-lg border px-3 py-2 transition-all ${
                    badge.earned
                      ? "border-warning/30 bg-warning/5"
                      : "border-border/50 bg-card opacity-50 grayscale"
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    badge.earned ? "bg-warning/15" : "bg-muted"
                  }`}>
                    <Award className={`h-3.5 w-3.5 ${badge.earned ? "text-warning" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">{badge.name}</span>
                  {badge.earned && (
                    <LinkedInShare type="badge" title={badge.name} compact />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar trilha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={categoryFilter === null && !showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setCategoryFilter(null); setShowFavoritesOnly(false); }}
              className={categoryFilter === null && !showFavoritesOnly ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-8" : "h-8"}
            >
              Todas
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => { setCategoryFilter(cat); setShowFavoritesOnly(false); }}
                className={categoryFilter === cat ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-8" : "h-8"}
              >
                {cat}
              </Button>
            ))}
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCategoryFilter(null); }}
              className={showFavoritesOnly ? "bg-gradient-nexti text-primary-foreground hover:opacity-90 h-8" : "h-8"}
            >
              <Heart className="h-3.5 w-3.5 mr-1" />
              Favoritas
            </Button>
          </div>
        </div>

        {/* Track grid */}
        {filtered.length === 0 ? (
          <div className="card-surface p-12 text-center text-muted-foreground">
            Nenhuma trilha encontrada.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((track, i) => (
              <TrackCard
                key={track.id}
                trackId={track.id}
                title={track.title}
                description={track.description || ""}
                category={track.category || ""}
                totalLessons={track.lessons?.length || 0}
                estimatedHours={track.estimated_hours || 0}
                index={i}
                isEnrolled={track.enrollments?.length > 0}
                isCompleted={track.enrollments?.some((e) => e.status === "completed") || false}
                isFavorite={favorites.has(track.id)}
                onToggleFavorite={() => toggleFavorite(track.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
