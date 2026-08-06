import { supabase } from "@/integrations/supabase/client";
import { touchPresence } from "@/lib/presence";

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

export async function getTrackProgressDB(
  userId: string,
  trackId: string,
  includeQuizAttempts = true
): Promise<TrackProgressDB> {
  const base: TrackProgressDB = { lessons: {}, quizScore: null, quizPassed: false, completedAt: null };

  const [{ data: lp }, { data: qa }] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("lesson_id, completed, watched_seconds")
      .eq("user_id", userId)
      .eq("track_id", trackId),
    includeQuizAttempts
      ? supabase
          .from("quiz_attempts")
          .select("score, passed, attempted_at")
          .eq("user_id", userId)
          .order("attempted_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null as null | { score: number; passed: boolean | null; attempted_at: string | null }[] }),
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

// Coalescência de escritas de progresso:
// - ignora gravações que não avançam o tempo já persistido (idempotência);
// - mantém no máximo uma requisição em voo por aula, guardando o último valor
//   pendente para enviar em seguida. Evita rajadas de writes com muitos usuários.
const lastPersisted = new Map<string, number>();
const inFlight = new Map<string, boolean>();
const pending = new Map<string, number>();

async function flushProgress(key: string, userId: string, trackId: string, lessonId: string) {
  if (inFlight.get(key)) return;
  const value = pending.get(key);
  if (value === undefined) return;
  pending.delete(key);
  inFlight.set(key, true);
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      track_id: trackId,
      lesson_id: lessonId,
      watched_seconds: value,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );
  inFlight.set(key, false);
  if (error) {
    console.error("savePartialProgressDB error:", error.message);
    // devolve o valor à fila para nova tentativa no próximo tick de progresso
    if (!pending.has(key)) pending.set(key, value);
    return;
  }
  lastPersisted.set(key, value);
  if (pending.has(key)) void flushProgress(key, userId, trackId, lessonId);
}

export async function savePartialProgressDB(
  userId: string,
  trackId: string,
  lessonId: string,
  watchedSeconds: number
) {
  const key = `${userId}:${lessonId}`;
  const seconds = Math.max(0, Math.round(watchedSeconds));
  if (seconds <= (lastPersisted.get(key) ?? -1)) return; // nada novo para gravar
  pending.set(key, Math.max(seconds, pending.get(key) ?? 0));
  await flushProgress(key, userId, trackId, lessonId);
}

export async function markLessonCompleteDB(
  userId: string,
  trackId: string,
  lessonId: string,
  watchedSeconds: number
) {
  const { error } = await supabase.from("lesson_progress").upsert(
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
  if (error) console.error("markLessonCompleteDB error:", error);
  else lastPersisted.set(`${userId}:${lessonId}`, Math.max(0, Math.round(watchedSeconds)));

  // Presença atualizada pelo escritor único (não bloqueia a conclusão da aula)
  void touchPresence(userId);
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
