import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function timeit<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  return fn().then((result) => ({ result, ms: Math.round((performance.now() - start) * 100) / 100 }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const fnStart = performance.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Check admin role instead of hardcoded email
    const { data: roleData } = await createClient(supabaseUrl, serviceKey)
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // ─── Benchmark critical DB queries ───
    const benchmarks = await Promise.all([
      // 1. Profile lookup (auth flow critical path)
      timeit(() => admin.from("profiles").select("id, nome, empresa").limit(1)),
      // 2. Tracks listing (main training page)
      timeit(() => admin.from("tracks").select("id, title, category, is_active").eq("is_active", true)),
      // 3. Lessons listing with join (track detail page)
      timeit(() => admin.from("lessons").select("id, title, track_id, order_index").limit(50)),
      // 4. Enrollments query (dashboard critical)
      timeit(() => admin.from("enrollments").select("id, track_id, status, user_id").limit(100)),
      // 5. Lesson progress (heaviest table, most joins)
      timeit(() => admin.from("lesson_progress").select("id, lesson_id, completed").limit(100)),
      // 6. Quiz questions (quiz page load)
      timeit(() => admin.from("quiz_questions").select("id, quiz_id, question").limit(50)),
      // 7. Notifications (bell icon, every page)
      timeit(() => admin.from("notifications").select("id, title, read").eq("read", false).limit(20)),
      // 8. Leaderboard (complex aggregation proxy)
      timeit(() => admin.from("user_levels").select("user_id, total_xp, current_level").order("total_xp", { ascending: false }).limit(50)),
      // 9. Certificates (completion flow)
      timeit(() => admin.from("certificates").select("id, user_id, track_id").limit(50)),
      // 10. Forum posts (community page)
      timeit(() => admin.from("forum_posts").select("id, title, user_id, created_at").order("created_at", { ascending: false }).limit(20)),
    ]);

    const queryBenchmarks = [
      { name: "Profile Lookup", endpoint: "/auth", ms: benchmarks[0].ms, category: "auth" },
      { name: "Tracks Listing", endpoint: "/treinamento", ms: benchmarks[1].ms, category: "content" },
      { name: "Lessons Listing", endpoint: "/trilha/:id", ms: benchmarks[2].ms, category: "content" },
      { name: "Enrollments Query", endpoint: "/dashboard", ms: benchmarks[3].ms, category: "dashboard" },
      { name: "Lesson Progress", endpoint: "/trilha/:id", ms: benchmarks[4].ms, category: "progress" },
      { name: "Quiz Questions", endpoint: "/quiz", ms: benchmarks[5].ms, category: "assessment" },
      { name: "Notifications", endpoint: "global", ms: benchmarks[6].ms, category: "ux" },
      { name: "Leaderboard", endpoint: "/leaderboard", ms: benchmarks[7].ms, category: "gamification" },
      { name: "Certificates", endpoint: "/certificados", ms: benchmarks[8].ms, category: "completion" },
      { name: "Forum Posts", endpoint: "/forum", ms: benchmarks[9].ms, category: "community" },
    ];

    const avgResponseTime = Math.round(queryBenchmarks.reduce((s, q) => s + q.ms, 0) / queryBenchmarks.length * 100) / 100;
    const maxResponseTime = Math.max(...queryBenchmarks.map((q) => q.ms));
    const p95ResponseTime = queryBenchmarks.map((q) => q.ms).sort((a, b) => a - b)[Math.floor(queryBenchmarks.length * 0.95)];

    // ─── Error & reliability metrics ───
    const [errorLogsResult, totalLogsResult] = await Promise.all([
      admin.from("audit_logs").select("*", { count: "exact", head: true })
        .ilike("action", "%error%").gte("created_at", oneDayAgo),
      admin.from("audit_logs").select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo),
    ]);

    const errorCount = errorLogsResult.count || 0;
    const totalActions = totalLogsResult.count || 0;
    const errorRate = totalActions > 0 ? Math.round((errorCount / totalActions) * 10000) / 100 : 0;

    // ─── Throughput metrics ───
    const [
      lessonProgressHour,
      quizAttemptsHour,
      enrollmentsHour,
    ] = await Promise.all([
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).gte("last_watched_at", oneHourAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", oneHourAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", oneHourAgo),
    ]);

    // ─── Data volume (capacity planning) ───
    const [
      totalProfiles, totalEnrollments, totalLessonProgress,
      totalQuizAttempts, totalForumPosts, totalNotifications,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("forum_posts").select("*", { count: "exact", head: true }),
      admin.from("notifications").select("*", { count: "exact", head: true }),
    ]);

    // ─── LMS-specific SLIs ───
    // SLI 1: Video availability (lessons with video_url not null / total lessons)
    const [lessonsWithVideo, lessonsAll] = await Promise.all([
      admin.from("lessons").select("*", { count: "exact", head: true }).not("video_url", "is", null),
      admin.from("lessons").select("*", { count: "exact", head: true }),
    ]);
    const videoAvailability = (lessonsAll.count || 0) > 0
      ? Math.round(((lessonsWithVideo.count || 0) / (lessonsAll.count || 1)) * 100) : 0;

    // SLI 2: Content completeness (tracks with at least 1 lesson / total active tracks)
    const tracksWithLessons = await admin.from("lessons").select("track_id").limit(1000);
    const uniqueTracksWithContent = new Set((tracksWithLessons.data || []).map((l: any) => l.track_id)).size;
    const totalActiveTracks = benchmarks[1].result.data?.length || 0;
    const contentCompleteness = totalActiveTracks > 0
      ? Math.round((uniqueTracksWithContent / totalActiveTracks) * 100) : 0;

    // SLI 3: Quiz coverage (tracks with quizzes / total active tracks)
    const quizzesData = await admin.from("quizzes").select("track_id");
    const tracksWithQuizzes = new Set((quizzesData.data || []).map((q: any) => q.track_id)).size;
    const quizCoverage = totalActiveTracks > 0
      ? Math.round((tracksWithQuizzes / totalActiveTracks) * 100) : 0;

    const totalFnTime = Math.round((performance.now() - fnStart) * 100) / 100;

    // ─── SLO evaluation ───
    const slos = [
      { name: "DB Avg Response < 200ms", target: 200, actual: avgResponseTime, met: avgResponseTime < 200 },
      { name: "DB P95 Response < 500ms", target: 500, actual: p95ResponseTime, met: p95ResponseTime < 500 },
      { name: "Error Rate < 1%", target: 1, actual: errorRate, met: errorRate < 1 },
      { name: "Video Availability > 80%", target: 80, actual: videoAvailability, met: videoAvailability > 80 },
      { name: "Content Completeness > 90%", target: 90, actual: contentCompleteness, met: contentCompleteness > 90 },
      { name: "Quiz Coverage > 50%", target: 50, actual: quizCoverage, met: quizCoverage > 50 },
    ];

    const sloScore = Math.round((slos.filter((s) => s.met).length / slos.length) * 100);

    const metrics = {
      timestamp: now.toISOString(),
      executionTime: totalFnTime,
      queryBenchmarks,
      responseTimeSummary: {
        avg: avgResponseTime,
        max: maxResponseTime,
        p95: p95ResponseTime,
      },
      reliability: {
        errorCount,
        totalActions,
        errorRate,
        uptimeProxy: 100 - errorRate,
      },
      throughput: {
        lessonProgressPerHour: lessonProgressHour.count || 0,
        quizAttemptsPerHour: quizAttemptsHour.count || 0,
        enrollmentsPerHour: enrollmentsHour.count || 0,
      },
      dataVolume: {
        profiles: totalProfiles.count || 0,
        enrollments: totalEnrollments.count || 0,
        lessonProgress: totalLessonProgress.count || 0,
        quizAttempts: totalQuizAttempts.count || 0,
        forumPosts: totalForumPosts.count || 0,
        notifications: totalNotifications.count || 0,
      },
      lmsHealth: {
        videoAvailability,
        contentCompleteness,
        quizCoverage,
      },
      slos,
      sloScore,
    };

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("performance-metrics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
