/**
 * Centralized React Query key factory.
 * Every query key used by the app should come from here so we can
 * invalidate / prefetch consistently.
 */
export const queryKeys = {
  // ── Tracks ──
  tracks: {
    all: ["tracks"] as const,
    list: (active?: boolean) => ["tracks", "list", { active }] as const,
    detail: (trackId: string) => ["tracks", "detail", trackId] as const,
  },

  // ── Lessons ──
  lessons: {
    byTrack: (trackId: string) => ["lessons", trackId] as const,
  },

  // ── Progress ──
  progress: {
    all: (userId: string) => ["progress", userId] as const,
    track: (userId: string, trackId: string) => ["progress", userId, trackId] as const,
    stats: (userId: string) => ["progress", "stats", userId] as const,
    lastWatched: (userId: string) => ["progress", "lastWatched", userId] as const,
  },

  // ── Enrollments ──
  enrollments: {
    user: (userId: string) => ["enrollments", userId] as const,
  },

  // ── Gamification ──
  gamification: {
    data: (userId: string) => ["gamification", userId] as const,
    badges: (userId: string) => ["badges", userId] as const,
    allBadges: ["badges", "all"] as const,
  },

  // ── Profile ──
  profile: {
    user: (userId: string) => ["profile", userId] as const,
    colleagues: (empresa: string) => ["profile", "colleagues", empresa] as const,
  },

  // ── Favorites ──
  favorites: {
    user: (userId: string) => ["favorites", userId] as const,
  },

  // ── Training ──
  training: {
    modules: ["training", "modules"] as const,
    requests: (userId: string) => ["training", "requests", userId] as const,
  },

  // ── Rewards ──
  rewards: {
    all: ["rewards"] as const,
    redemptions: (userId: string) => ["rewards", "redemptions", userId] as const,
  },

  // ── Notifications ──
  notifications: {
    user: (userId: string) => ["notifications", userId] as const,
  },

  // ── Leaderboard ──
  leaderboard: {
    company: (empresa: string) => ["leaderboard", empresa] as const,
  },

  // ── Quiz ──
  quiz: {
    attempts: (userId: string) => ["quiz", "attempts", userId] as const,
    byTrack: (trackId: string) => ["quiz", "track", trackId] as const,
  },
} as const;
