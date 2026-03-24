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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow both authenticated super-admin calls AND cron (no auth header)
    const authHeader = req.headers.get("Authorization");
    const isCron = !authHeader || authHeader === `Bearer ${anonKey}`;

    if (!isCron) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) throw new Error("Unauthorized");
      if (user.email !== "robson@nexti.com") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Benchmark critical DB queries
    const benchmarks = await Promise.all([
      timeit(() => admin.from("profiles").select("id, nome, empresa").limit(1)),
      timeit(() => admin.from("tracks").select("id, title, category, is_active").eq("is_active", true)),
      timeit(() => admin.from("lessons").select("id, title, track_id, order_index").limit(50)),
      timeit(() => admin.from("enrollments").select("id, track_id, status, user_id").limit(100)),
      timeit(() => admin.from("lesson_progress").select("id, lesson_id, completed").limit(100)),
      timeit(() => admin.from("quiz_questions").select("id, quiz_id, question").limit(50)),
      timeit(() => admin.from("notifications").select("id, title, read").eq("read", false).limit(20)),
      timeit(() => admin.from("user_levels").select("user_id, total_xp, current_level").order("total_xp", { ascending: false }).limit(50)),
      timeit(() => admin.from("certificates").select("id, user_id, track_id").limit(50)),
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

    const times = queryBenchmarks.map((q) => q.ms).sort((a, b) => a - b);
    const avgResponseTime = Math.round(times.reduce((s, t) => s + t, 0) / times.length * 100) / 100;
    const maxResponseTime = Math.max(...times);
    const p95ResponseTime = times[Math.floor(times.length * 0.95)];

    // Error & reliability
    const [errorLogsResult, totalLogsResult] = await Promise.all([
      admin.from("audit_logs").select("*", { count: "exact", head: true }).ilike("action", "%error%").gte("created_at", oneDayAgo),
      admin.from("audit_logs").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
    ]);
    const errorCount = errorLogsResult.count || 0;
    const totalActions = totalLogsResult.count || 0;
    const errorRate = totalActions > 0 ? Math.round((errorCount / totalActions) * 10000) / 100 : 0;

    // Throughput
    const [lessonProgressHour, quizAttemptsHour, enrollmentsHour] = await Promise.all([
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).gte("last_watched_at", oneHourAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", oneHourAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", oneHourAgo),
    ]);

    // User metrics
    const [activeNow, activeToday, enrollmentsTotal, lessonsCompletedToday] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", fiveMinAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", oneDayAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).eq("completed", true).gte("last_watched_at", oneDayAgo),
    ]);

    // Data volume
    const [totalProfiles, totalEnrollments, totalLessonProgress, totalQuizAttempts, totalForumPosts, totalNotifications] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("forum_posts").select("*", { count: "exact", head: true }),
      admin.from("notifications").select("*", { count: "exact", head: true }),
    ]);

    // LMS health SLIs
    const [lessonsWithVideo, lessonsAll, quizzesData] = await Promise.all([
      admin.from("lessons").select("*", { count: "exact", head: true }).not("video_url", "is", null),
      admin.from("lessons").select("*", { count: "exact", head: true }),
      admin.from("quizzes").select("track_id"),
    ]);

    const totalActiveTracks = benchmarks[1].result.data?.length || 0;
    const tracksWithLessonsData = await admin.from("lessons").select("track_id").limit(1000);
    const uniqueTracksWithContent = new Set((tracksWithLessonsData.data || []).map((l: any) => l.track_id)).size;

    const videoAvailability = (lessonsAll.count || 0) > 0
      ? Math.round(((lessonsWithVideo.count || 0) / (lessonsAll.count || 1)) * 100) : 0;
    const contentCompleteness = totalActiveTracks > 0
      ? Math.round((uniqueTracksWithContent / totalActiveTracks) * 100) : 0;
    const tracksWithQuizzes = new Set((quizzesData.data || []).map((q: any) => q.track_id)).size;
    const quizCoverage = totalActiveTracks > 0
      ? Math.round((tracksWithQuizzes / totalActiveTracks) * 100) : 0;

    // Quiz pass rate
    const [quizTotal, quizPassed] = await Promise.all([
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("passed", true),
    ]);
    const quizPassRate = (quizTotal.count || 0) > 0
      ? Math.round(((quizPassed.count || 0) / (quizTotal.count || 1)) * 100) : 0;

    // SLOs
    const slos = [
      { name: "DB Avg Response < 200ms", target: 200, actual: avgResponseTime, met: avgResponseTime < 200 },
      { name: "DB P95 Response < 500ms", target: 500, actual: p95ResponseTime, met: p95ResponseTime < 500 },
      { name: "Error Rate < 1%", target: 1, actual: errorRate, met: errorRate < 1 },
      { name: "Video Availability > 80%", target: 80, actual: videoAvailability, met: videoAvailability > 80 },
      { name: "Content Completeness > 90%", target: 90, actual: contentCompleteness, met: contentCompleteness > 90 },
      { name: "Quiz Coverage > 50%", target: 50, actual: quizCoverage, met: quizCoverage > 50 },
    ];
    const sloScore = Math.round((slos.filter((s) => s.met).length / slos.length) * 100);

    const executionTime = Math.round((performance.now() - fnStart) * 100) / 100;

    const dataVolume = {
      profiles: totalProfiles.count || 0,
      enrollments: totalEnrollments.count || 0,
      lessonProgress: totalLessonProgress.count || 0,
      quizAttempts: totalQuizAttempts.count || 0,
      forumPosts: totalForumPosts.count || 0,
      notifications: totalNotifications.count || 0,
    };

    // Save snapshot
    const { error: insertError } = await admin.from("performance_snapshots").insert({
      captured_at: now.toISOString(),
      avg_response_ms: avgResponseTime,
      p95_response_ms: p95ResponseTime,
      max_response_ms: maxResponseTime,
      error_rate: errorRate,
      uptime_proxy: 100 - errorRate,
      slo_score: sloScore,
      users_online: activeNow.count || 0,
      active_today: activeToday.count || 0,
      enrollments_total: enrollmentsTotal.count || 0,
      lessons_completed_today: lessonsCompletedToday.count || 0,
      quiz_pass_rate: quizPassRate,
      video_availability: videoAvailability,
      content_completeness: contentCompleteness,
      quiz_coverage: quizCoverage,
      throughput_lessons_hour: lessonProgressHour.count || 0,
      throughput_quizzes_hour: quizAttemptsHour.count || 0,
      throughput_enrollments_hour: enrollmentsHour.count || 0,
      data_volume: dataVolume,
      query_benchmarks: queryBenchmarks,
      execution_time_ms: executionTime,
    });

    if (insertError) console.error("Snapshot insert error:", insertError);

    const metrics = {
      timestamp: now.toISOString(),
      executionTime,
      queryBenchmarks,
      responseTimeSummary: { avg: avgResponseTime, max: maxResponseTime, p95: p95ResponseTime },
      reliability: { errorCount, totalActions, errorRate, uptimeProxy: 100 - errorRate },
      throughput: {
        lessonProgressPerHour: lessonProgressHour.count || 0,
        quizAttemptsPerHour: quizAttemptsHour.count || 0,
        enrollmentsPerHour: enrollmentsHour.count || 0,
      },
      dataVolume,
      lmsHealth: { videoAvailability, contentCompleteness, quizCoverage },
      slos,
      sloScore,
      snapshotSaved: !insertError,
    };

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("performance-snapshot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
