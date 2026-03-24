import { useAuth } from "@/contexts/AuthContext";
import { getLevelInfo } from "@/lib/gamification";
import { useBadgesPageData } from "@/hooks/useDashboardData";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Award, Trophy, Star, Zap, Target, Shield, Flame, BookOpen, Crown, Gem, Lock, CheckCircle2, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import LinkedInShare from "@/components/LinkedInShare";

interface BadgeData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  criteria_type: string;
  criteria_value: number | null;
  earned: boolean;
  earned_at: string | null;
}

const iconComponents: Record<string, React.ElementType> = {
  award: Award, trophy: Trophy, star: Star, zap: Zap, target: Target,
  shield: Shield, flame: Flame, "book-open": BookOpen, crown: Crown, gem: Gem,
};

const criteriaLabels: Record<string, string> = {
  track_completion: "Completar trilhas", quiz_pass: "Passar em quizzes",
  quiz_score: "Nota mínima no quiz", quiz_module_pass: "Passar em módulo de quiz",
  streak: "Dias consecutivos", lesson_count: "Aulas completadas",
  xp_threshold: "XP acumulado", forum_posts: "Posts no fórum",
};

const BadgesPage = () => {
  const { user } = useAuth();
  const { data, isLoading: loading } = useBadgesPageData();

  const badges = (data?.badges ?? []) as BadgeData[];
  const gamification = data?.gamification ?? { coins: 0, xp: 0, level: 1, streak: 0, longestStreak: 0 };
  const userProgress = data?.userProgress ?? {
    completedTracks: 0, completedLessons: 0, quizzesPassed: 0, forumPosts: 0, bestQuizScore: 0,
  };

  const getProgressForBadge = (badge: BadgeData): number => {
    if (badge.earned) return 100;
    const target = badge.criteria_value || 1;
    let current = 0;
    switch (badge.criteria_type) {
      case "track_completion": current = userProgress.completedTracks; break;
      case "lesson_count": current = userProgress.completedLessons; break;
      case "quiz_pass": case "quiz_module_pass": current = userProgress.quizzesPassed; break;
      case "quiz_score": current = userProgress.bestQuizScore; break;
      case "streak": current = gamification.streak; break;
      case "xp_threshold": current = gamification.xp; break;
      case "forum_posts": current = userProgress.forumPosts; break;
    }
    return Math.min(100, Math.round((current / target) * 100));
  };

  const earnedCount = badges.filter((b) => b.earned).length;
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
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-nexti">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-1">
                <Award className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
                <h1 className="font-display text-xl sm:text-3xl font-extrabold text-primary-foreground">
                  Minhas Insígnias
                </h1>
              </div>
              <p className="text-sm text-primary-foreground/80">
                Conquiste insígnias completando trilhas, quizzes e desafios.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4"
            >
              <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <span className="font-display text-2xl font-extrabold text-primary-foreground">
                  {earnedCount}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-primary-foreground/70 font-semibold">
                  Conquistadas
                </span>
              </div>
              <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <span className="font-display text-2xl font-extrabold text-primary-foreground">
                  {badges.length}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-primary-foreground/70 font-semibold">
                  Total
                </span>
              </div>
              <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
                <span className="font-display text-2xl font-extrabold text-primary-foreground">
                  Lv.{gamification.level}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-primary-foreground/70 font-semibold">
                  {levelInfo.title}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Overall badge progress */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 flex items-center gap-3"
          >
            <div className="flex-1">
              <Progress
                value={badges.length > 0 ? (earnedCount / badges.length) * 100 : 0}
                className="h-2 bg-white/20 [&>div]:bg-white"
              />
            </div>
            <span className="text-sm font-bold text-primary-foreground tabular-nums">
              {badges.length > 0 ? Math.round((earnedCount / badges.length) * 100) : 0}%
            </span>
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Earned badges section */}
        {earnedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Conquistadas
              <Badge variant="secondary" className="ml-1 text-xs">{earnedCount}</Badge>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges
                .filter((b) => b.earned)
                .map((badge, i) => {
                  const IconComp = iconComponents[badge.icon || "award"] || Award;
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="card-surface p-4 sm:p-5 border-success/20 bg-success/5 relative overflow-hidden group"
                    >
                      <div className="absolute top-2 right-2">
                        <LinkedInShare type="badge" title={badge.name} compact />
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success/15 shadow-sm">
                          <IconComp className="h-6 w-6 text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-sm font-bold text-foreground">{badge.name}</h3>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className="bg-success/15 text-success border-success/20 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Conquistada
                            </Badge>
                            {badge.earned_at && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(badge.earned_at).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Locked badges section */}
        {badges.filter((b) => !b.earned).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Em progresso
              <Badge variant="secondary" className="ml-1 text-xs">
                {badges.length - earnedCount}
              </Badge>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges
                .filter((b) => !b.earned)
                .map((badge, i) => {
                  const IconComp = iconComponents[badge.icon || "award"] || Award;
                  const progress = getProgressForBadge(badge);
                  const criteriaLabel = criteriaLabels[badge.criteria_type] || badge.criteria_type;

                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="card-surface p-4 sm:p-5 relative"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                          <IconComp className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-sm font-bold text-foreground">{badge.name}</h3>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {criteriaLabel}
                            {badge.criteria_value && ` • Meta: ${badge.criteria_value}`}
                          </p>
                          <div className="mt-2.5 flex items-center gap-2">
                            <Progress
                              value={progress}
                              className={cn(
                                "h-2 flex-1",
                                progress > 60 ? "[&>div]:bg-warning" : "[&>div]:bg-primary"
                              )}
                            />
                            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                              {progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {badges.length === 0 && (
          <div className="text-center py-20">
            <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Nenhuma insígnia disponível</h3>
            <p className="text-sm text-muted-foreground mt-1">
              As insígnias serão adicionadas em breve. Continue estudando!
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BadgesPage;
