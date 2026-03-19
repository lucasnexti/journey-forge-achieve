import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { getUserStats, getLastWatchedLesson } from "@/lib/progressDB";
import Header from "@/components/Header";
import TrackCard from "@/components/TrackCard";
import OnboardingWizard from "@/components/OnboardingWizard";
import { BookOpen, Clock, Trophy, Play, Search, Filter, Star, Users, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [badges, setBadges] = useState<{ name: string; icon: string }[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: trackData }, statsData, lastData, { data: userBadges }] = await Promise.all([
        supabase
          .from("tracks")
          .select("id, title, description, category, estimated_hours, is_active, order_index, lessons(id), enrollments(id, status)")
          .eq("is_active", true)
          .order("order_index"),
        getUserStats(user.id),
        getLastWatchedLesson(user.id),
        supabase
          .from("user_badges")
          .select("badges(name, icon)")
          .eq("user_id", user.id),
      ]);

      setTracks((trackData as unknown as TrackRow[]) || []);
      setStats(statsData);
      setLastLesson(lastData);
      setBadges(
        (userBadges || []).map((ub: any) => ({
          name: ub.badges?.name || "",
          icon: ub.badges?.icon || "award",
        }))
      );
      setLoading(false);
    };

    load();
  }, [user]);

  const categories = [...new Set(tracks.map((t) => t.category).filter(Boolean))] as string[];

  const filtered = tracks.filter((t) => {
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || t.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const completedCount = tracks.filter((t) =>
    t.enrollments?.some((e) => e.status === "completed")
  ).length;

  const formatTime = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}min`;
    return `${(secs / 3600).toFixed(1)}h`;
  };

  const statCards = [
    { icon: BookOpen, label: "Trilhas Concluídas", value: `${completedCount}/${tracks.length}` },
    { icon: Clock, label: "Tempo Assistido", value: formatTime(stats.totalWatched) },
    { icon: Trophy, label: "Nota Média", value: stats.avgScore > 0 ? `${stats.avgScore}%` : "—" },
  ];

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
      <Header />

      <div className="bg-gradient-nexti">
        <div className="container py-10">
          <h1 className="font-display text-3xl font-extrabold text-primary-foreground">
            Minhas Trilhas
          </h1>
          <p className="mt-2 text-primary-foreground/80">
            Desenvolva suas competências em trilhas estruturadas.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="tabular-nums font-display text-xl font-bold text-primary-foreground">{value}</p>
                  <p className="text-xs text-primary-foreground/70">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Badges earned */}
          {badges.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Star className="h-4 w-4 text-primary-foreground/70" />
              {badges.map((b, i) => (
                <Badge key={i} variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20 text-xs">
                  {b.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="container py-8">
        {/* Continue where you left off */}
        {lastLesson && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <button
              onClick={() => navigate(`/trilha/${lastLesson.track_id}`)}
              className="w-full card-surface-hover flex items-center gap-4 p-5 text-left group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-nexti">
                <Play className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Continuar de onde parou
                </p>
                <p className="mt-0.5 font-display text-base font-semibold text-foreground truncate">
                  {lastLesson.lesson_title}
                </p>
                <p className="text-sm text-muted-foreground">{lastLesson.track_title}</p>
              </div>
              <Play className="h-5 w-5 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        )}

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar trilha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={categoryFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(null)}
              className={categoryFilter === null ? "bg-gradient-nexti text-primary-foreground hover:opacity-90" : ""}
            >
              Todas
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
                className={categoryFilter === cat ? "bg-gradient-nexti text-primary-foreground hover:opacity-90" : ""}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Track list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card-surface p-12 text-center text-muted-foreground">
              Nenhuma trilha encontrada.
            </div>
          ) : (
            filtered.map((track, i) => (
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
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
