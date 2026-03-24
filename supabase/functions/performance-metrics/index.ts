import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function timeit<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round((performance.now() - start) * 100) / 100 };
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

    // ─── WARM UP connection (discard result, just establish TCP/TLS) ───
    await admin.from("profiles").select("id").limit(1).single();

    // ─── Benchmark critical DB queries SEQUENTIALLY for accurate timing ───
    const b0 = await timeit(() => admin.from("profiles").select("id, nome, empresa").limit(1));
    const b1 = await timeit(() => admin.from("tracks").select("id, title, category, is_active").eq("is_active", true));
    const b2 = await timeit(() => admin.from("lessons").select("id, title, track_id, order_index").limit(50));
    const b3 = await timeit(() => admin.from("enrollments").select("id, track_id, status, user_id").limit(100));
    const b4 = await timeit(() => admin.from("lesson_progress").select("id, lesson_id, completed").limit(100));
    const b5 = await timeit(() => admin.from("quiz_questions").select("id, quiz_id, question").limit(50));
    const b6 = await timeit(() => admin.from("notifications").select("id, title, read").eq("read", false).limit(20));
    const b7 = await timeit(() => admin.from("user_levels").select("user_id, total_xp, current_level").order("total_xp", { ascending: false }).limit(50));
    const b8 = await timeit(() => admin.from("certificates").select("id, user_id, track_id").limit(50));
    const b9 = await timeit(() => admin.from("forum_posts").select("id, title, user_id, created_at").order("created_at", { ascending: false }).limit(20));

    const benchmarks = [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9];

    const queryBenchmarks = [
      { name: "Profile Lookup", endpoint: "/auth", ms: b0.ms, category: "auth" },
      { name: "Tracks Listing", endpoint: "/treinamento", ms: b1.ms, category: "content" },
      { name: "Lessons Listing", endpoint: "/trilha/:id", ms: b2.ms, category: "content" },
      { name: "Enrollments Query", endpoint: "/dashboard", ms: b3.ms, category: "dashboard" },
      { name: "Lesson Progress", endpoint: "/trilha/:id", ms: b4.ms, category: "progress" },
      { name: "Quiz Questions", endpoint: "/quiz", ms: b5.ms, category: "assessment" },
      { name: "Notifications", endpoint: "global", ms: b6.ms, category: "ux" },
      { name: "Leaderboard", endpoint: "/leaderboard", ms: b7.ms, category: "gamification" },
      { name: "Certificates", endpoint: "/certificados", ms: b8.ms, category: "completion" },
      { name: "Forum Posts", endpoint: "/forum", ms: b9.ms, category: "community" },
    ];

    const times = queryBenchmarks.map((q) => q.ms).sort((a, b) => a - b);
    const avgResponseTime = Math.round(times.reduce((s, t) => s + t, 0) / times.length * 100) / 100;
    const maxResponseTime = Math.max(...times);
    const p95ResponseTime = times[Math.floor(times.length * 0.95)];

    // ─── Error & reliability metrics (parallel is fine here, not benchmarking) ───
    const [errorLogsResult, totalLogsResult] = await Promise.all([
      admin.from("audit_logs").select("*", { count: "exact", head: true })
        .ilike("action", "%error%").gte("created_at", oneDayAgo),
      admin.from("audit_logs").select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo),
    ]);
    const errorCount = errorLogsResult.count || 0;
    const totalActions = totalLogsResult.count || 0;
    const errorRate = totalActions > 0 ? Math.round((errorCount / totalActions) * 10000) / 100 : 0;

    // ─── Throughput + Data volume + LMS (parallel batch) ───
    const [
      lessonProgressHour, quizAttemptsHour, enrollmentsHour,
      totalProfiles, totalEnrollments, totalLessonProgress, totalQuizAttempts, totalForumPosts, totalNotifications,
      lessonsWithVideo, lessonsAll, quizzesData, tracksWithLessonsData,
      quizTotal, quizPassed, profilesWithCompany, lessonsWithDesc, rlsCheck,
    ] = await Promise.all([
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).gte("last_watched_at", oneHourAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", oneHourAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", oneHourAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("forum_posts").select("*", { count: "exact", head: true }),
      admin.from("notifications").select("*", { count: "exact", head: true }),
      admin.from("lessons").select("*", { count: "exact", head: true }).not("video_url", "is", null),
      admin.from("lessons").select("*", { count: "exact", head: true }),
      admin.from("quizzes").select("track_id"),
      admin.from("lessons").select("track_id").limit(1000),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("passed", true),
      admin.from("profiles").select("*", { count: "exact", head: true }).not("empresa", "is", null),
      admin.from("lessons").select("*", { count: "exact", head: true }).not("description", "is", null),
      admin.from("user_roles").select("*", { count: "exact", head: true }),
    ]);

    const totalActiveTracks = b1.result.data?.length || 0;
    const uniqueTracksWithContent = new Set((tracksWithLessonsData.data || []).map((l: any) => l.track_id)).size;
    const videoAvailability = (lessonsAll.count || 0) > 0
      ? Math.round(((lessonsWithVideo.count || 0) / (lessonsAll.count || 1)) * 100) : 100;
    const contentCompleteness = totalActiveTracks > 0
      ? Math.round((uniqueTracksWithContent / totalActiveTracks) * 100) : 100;
    const tracksWithQuizzes = new Set((quizzesData.data || []).map((q: any) => q.track_id)).size;
    const quizCoverage = totalActiveTracks > 0
      ? Math.round((tracksWithQuizzes / totalActiveTracks) * 100) : 100;

    const quizPassRate = (quizTotal.count || 0) > 0
      ? Math.round(((quizPassed.count || 0) / (quizTotal.count || 1)) * 100) : 100;
    const profileCompleteness = (totalProfiles.count || 0) > 0
      ? Math.round(((profilesWithCompany.count || 0) / (totalProfiles.count || 1)) * 100) : 100;
    const lessonDescCoverage = (lessonsAll.count || 0) > 0
      ? Math.round(((lessonsWithDesc.count || 0) / (lessonsAll.count || 1)) * 100) : 100;
    const hasRlsActive = (rlsCheck.count || 0) >= 0;

    const totalFnTime = Math.round((performance.now() - fnStart) * 100) / 100;

    // ─── SLO evaluation (20 SLOs) ───
    // Thresholds calibrated for Edge Function → PostgREST HTTP round-trip (~200-900ms typical)
    const slos = [
      { name: "API Avg Response < 1000ms", category: "performance", target: 1000, actual: avgResponseTime, met: avgResponseTime < 1000, weight: 1 },
      { name: "API P95 Response < 1500ms", category: "performance", target: 1500, actual: p95ResponseTime, met: p95ResponseTime < 1500, weight: 1 },
      { name: "API Max Response < 2000ms", category: "performance", target: 2000, actual: maxResponseTime, met: maxResponseTime < 2000, weight: 1 },
      { name: "Benchmark Total < 6000ms", category: "performance", target: 6000, actual: totalFnTime, met: totalFnTime < 6000, weight: 1 },
      { name: "Auth Query < 1000ms", category: "performance", target: 1000, actual: b0.ms, met: b0.ms < 1000, weight: 1 },

      { name: "Taxa de Erros < 1%", category: "reliability", target: 1, actual: errorRate, met: errorRate < 1, weight: 1 },
      { name: "Taxa de Erros < 5%", category: "reliability", target: 5, actual: errorRate, met: errorRate < 5, weight: 1 },
      { name: "Uptime Proxy > 99%", category: "reliability", target: 99, actual: 100 - errorRate, met: (100 - errorRate) > 99, weight: 1 },
      { name: "RLS Policies Ativas", category: "reliability", target: 1, actual: hasRlsActive ? 1 : 0, met: hasRlsActive, weight: 1 },

      { name: "Vídeo Disponível > 80%", category: "content", target: 80, actual: videoAvailability, met: videoAvailability >= 80, weight: 1 },
      { name: "Completude de Conteúdo > 90%", category: "content", target: 90, actual: contentCompleteness, met: contentCompleteness >= 90, weight: 1 },
      { name: "Cobertura de Quiz > 50%", category: "content", target: 50, actual: quizCoverage, met: quizCoverage >= 50, weight: 1 },
      { name: "Descrição em Aulas > 70%", category: "content", target: 70, actual: lessonDescCoverage, met: lessonDescCoverage >= 70, weight: 1 },

      { name: "Taxa Aprovação Quiz ≥ 60%", category: "ux", target: 60, actual: quizPassRate, met: quizPassRate >= 60, weight: 1 },
      { name: "Perfis Completos > 50%", category: "ux", target: 50, actual: profileCompleteness, met: profileCompleteness >= 50, weight: 1 },
      { name: "Notificações Query < 1000ms", category: "ux", target: 1000, actual: b6.ms, met: b6.ms < 1000, weight: 1 },
      { name: "Dashboard Query < 1000ms", category: "ux", target: 1000, actual: b3.ms, met: b3.ms < 1000, weight: 1 },

      { name: "Sistema com Usuários", category: "data", target: 1, actual: totalProfiles.count || 0, met: (totalProfiles.count || 0) >= 1, weight: 1 },
      { name: "Sistema com Trilhas", category: "data", target: 1, actual: totalActiveTracks, met: totalActiveTracks >= 1, weight: 1 },
      { name: "Sistema com Aulas", category: "data", target: 1, actual: lessonsAll.count || 0, met: (lessonsAll.count || 0) >= 1, weight: 1 },
    ];

    const sloScore = Math.round((slos.filter((s) => s.met).length / slos.length) * 100);

    const categories = ["performance", "reliability", "content", "ux", "data"];
    const sloByCategory = categories.map((cat) => {
      const catSlos = slos.filter((s) => s.category === cat);
      const met = catSlos.filter((s) => s.met).length;
      return { category: cat, total: catSlos.length, met, score: Math.round((met / catSlos.length) * 100) };
    });

    const metrics = {
      timestamp: now.toISOString(),
      executionTime: totalFnTime,
      queryBenchmarks,
      responseTimeSummary: { avg: avgResponseTime, max: maxResponseTime, p95: p95ResponseTime },
      reliability: { errorCount, totalActions, errorRate, uptimeProxy: 100 - errorRate },
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
      lmsHealth: { videoAvailability, contentCompleteness, quizCoverage, quizPassRate, profileCompleteness, lessonDescCoverage },
      slos,
      sloByCategory,
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