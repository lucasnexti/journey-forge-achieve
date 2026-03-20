import { supabase } from "@/integrations/supabase/client";

// ──────── Types ────────
export interface LessonProgressDB {
  completed: boolean;
  watched_seconds: number;
}

export interface TrackProgressDB {
  lessons: Record<string, LessonProgressDB>;
  quizScore: number | null;
  quizPassed: boolean;
  completedAt: string | null;
}

// ──────── Read ────────

export async function getTrackProgressDB(userId: string, trackId: string): Promise<TrackProgressDB> {
  const base: TrackProgressDB = { lessons: {}, quizScore: null, quizPassed: false, completedAt: null };

  const [{ data: lp }, { data: qa }] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("lesson_id, completed, watched_seconds")
      .eq("user_id", userId)
      .eq("track_id", trackId),
    supabase
      .from("quiz_attempts")
      .select("score, passed, attempted_at")
      .eq("user_id", userId)
      .order("attempted_at", { ascending: false })
      .limit(10),
  ]);

  if (lp) {
    lp.forEach((row) => {
      base.lessons[row.lesson_id] = {
        completed: row.completed ?? false,
        watched_seconds: row.watched_seconds ?? 0,
      };
    });
  }

  // Find best quiz attempt for this track's quizzes
  if (qa && qa.length > 0) {
    const best = qa.reduce((a, b) => ((a.score ?? 0) > (b.score ?? 0) ? a : b));
    base.quizScore = best.score;
    base.quizPassed = best.passed ?? false;
    if (best.passed) base.completedAt = best.attempted_at;
  }

  return base;
}

export async function getLastWatchedLesson(userId: string): Promise<{
  lesson_id: string;
  track_id: string;
  lesson_title: string;
  track_title: string;
} | null> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, track_id, lessons(title), tracks(title)")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    lesson_id: data.lesson_id,
    track_id: data.track_id,
    lesson_title: (data.lessons as any)?.title || "",
    track_title: (data.tracks as any)?.title || "",
  };
}

// ──────── Write ────────

export async function savePartialProgressDB(
  userId: string,
  trackId: string,
  lessonId: string,
  watchedSeconds: number
) {
  await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      track_id: trackId,
      lesson_id: lessonId,
      watched_seconds: watchedSeconds,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );
}

export async function markLessonCompleteDB(
  userId: string,
  trackId: string,
  lessonId: string,
  watchedSeconds: number
) {
  await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      track_id: trackId,
      lesson_id: lessonId,
      completed: true,
      watched_seconds: watchedSeconds,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  // Update last_active_at on profile
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function saveQuizResultDB(
  userId: string,
  quizId: string,
  score: number,
  passed: boolean,
  answers: any[] = []
) {
  await supabase.from("quiz_attempts").insert({
    user_id: userId,
    quiz_id: quizId,
    score,
    passed,
    answers,
  });
}

// ──────── Stats ────────

export async function getUserStats(userId: string) {
  const [{ count: enrollCount }, { data: progress }, { data: attempts }] = await Promise.all([
    supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("lesson_progress").select("watched_seconds").eq("user_id", userId),
    supabase.from("quiz_attempts").select("score").eq("user_id", userId),
  ]);

  const totalWatched = progress?.reduce((a, b) => a + (b.watched_seconds ?? 0), 0) || 0;
  const scores = attempts?.map((a) => a.score).filter((s): s is number => s != null) || [];
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return { enrollments: enrollCount || 0, totalWatched, avgScore };
}
