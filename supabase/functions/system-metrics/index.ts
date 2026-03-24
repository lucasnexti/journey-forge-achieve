import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    if (user.email !== "robson@nexti.com") {
      return new Response(JSON.stringify({ error: "Forbidden — super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profilesCount,
      activeNow,
      activeToday,
      activeWeek,
      activeMonth,
      enrollmentsTotal,
      enrollmentsToday,
      enrollmentsWeek,
      enrollmentsMonth,
      lessonsCompletedToday,
      lessonsCompletedWeek,
      quizAttemptsToday,
      quizAttemptsWeek,
      quizPassedWeek,
      forumPostsToday,
      forumPostsWeek,
      tracksTotal,
      tracksActive,
      lessonsTotal,
      certificatesTotal,
      certificatesToday,
      certificatesWeek,
      trainingRequestsPending,
      trainingRequestsTotal,
      notificationsUnread,
      coinTransactionsToday,
      rewardRedemptionsPending,
      badgesEarnedToday,
      badgesEarnedWeek,
      companiesData,
      recentLogs,
      // Completion funnel data
      enrollmentsCompleted,
      // New users
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      // Activity by hour (last 24h lesson progress)
      recentLessonProgress,
      // Quiz performance
      quizAttemptsTotal,
      quizPassedTotal,
      // Streak data
      streakData,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", fiveMinAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", oneDayAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", sevenDaysAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", thirtyDaysAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", oneDayAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", sevenDaysAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", thirtyDaysAgo),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).eq("completed", true).gte("last_watched_at", oneDayAgo),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).eq("completed", true).gte("last_watched_at", sevenDaysAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", oneDayAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", sevenDaysAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("passed", true).gte("attempted_at", sevenDaysAgo),
      admin.from("forum_posts").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      admin.from("forum_posts").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      admin.from("tracks").select("*", { count: "exact", head: true }),
      admin.from("tracks").select("*", { count: "exact", head: true }).eq("is_active", true),
      admin.from("lessons").select("*", { count: "exact", head: true }),
      admin.from("certificates").select("*", { count: "exact", head: true }),
      admin.from("certificates").select("*", { count: "exact", head: true }).gte("issued_at", oneDayAgo),
      admin.from("certificates").select("*", { count: "exact", head: true }).gte("issued_at", sevenDaysAgo),
      admin.from("training_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("training_requests").select("*", { count: "exact", head: true }),
      admin.from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
      admin.from("coin_transactions").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      admin.from("reward_redemptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("user_badges").select("*", { count: "exact", head: true }).gte("earned_at", oneDayAgo),
      admin.from("user_badges").select("*", { count: "exact", head: true }).gte("earned_at", sevenDaysAgo),
      admin.from("profiles").select("empresa").not("empresa", "is", null),
      admin.from("audit_logs").select("id, action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(20),
      admin.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      admin.from("lesson_progress").select("last_watched_at").eq("completed", true).gte("last_watched_at", sevenDaysAgo).order("last_watched_at", { ascending: true }).limit(500),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("passed", true),
      admin.from("user_streaks").select("current_streak, longest_streak").order("current_streak", { ascending: false }).limit(100),
    ]);

    // Company breakdown
    const companyCounts: Record<string, number> = {};
    (companiesData.data || []).forEach((p: any) => {
      companyCounts[p.empresa] = (companyCounts[p.empresa] || 0) + 1;
    });

    // Activity heatmap: group lesson completions by day of week
    const dailyActivity: Record<string, number> = {};
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    (recentLessonProgress.data || []).forEach((lp: any) => {
      const d = new Date(lp.last_watched_at);
      const dayKey = dayLabels[d.getDay()];
      dailyActivity[dayKey] = (dailyActivity[dayKey] || 0) + 1;
    });
    const activityByDay = dayLabels.map((day) => ({ day, count: dailyActivity[day] || 0 }));

    // Streak distribution
    const streaks = (streakData.data || []) as { current_streak: number; longest_streak: number }[];
    const avgStreak = streaks.length > 0
      ? Math.round((streaks.reduce((s, r) => s + r.current_streak, 0) / streaks.length) * 10) / 10
      : 0;
    const maxStreak = streaks.length > 0 ? Math.max(...streaks.map((r) => r.longest_streak)) : 0;
    const activeStreaks = streaks.filter((r) => r.current_streak > 0).length;

    // KPIs
    const totalUsers = profilesCount.count || 0;
    const dauCount = activeToday.count || 0;
    const mauCount = activeMonth.count || 0;
    const dauMauRatio = mauCount > 0 ? Math.round((dauCount / mauCount) * 100) : 0;
    const enrollTotal = enrollmentsTotal.count || 0;
    const enrollCompleted = enrollmentsCompleted.count || 0;
    const completionRate = enrollTotal > 0 ? Math.round((enrollCompleted / enrollTotal) * 100) : 0;
    const quizTotal = quizAttemptsTotal.count || 0;
    const quizPassed = quizPassedTotal.count || 0;
    const quizPassRate = quizTotal > 0 ? Math.round((quizPassed / quizTotal) * 100) : 0;
    const retentionRate7d = totalUsers > 0 ? Math.round(((activeWeek.count || 0) / totalUsers) * 100) : 0;
    const retentionRate30d = totalUsers > 0 ? Math.round((mauCount / totalUsers) * 100) : 0;
    const growthRateWeek = totalUsers > 0 ? Math.round(((newUsersWeek.count || 0) / totalUsers) * 100 * 10) / 10 : 0;

    const metrics = {
      timestamp: now.toISOString(),
      users: {
        total: totalUsers,
        onlineNow: activeNow.count || 0,
        activeToday: dauCount,
        activeWeek: activeWeek.count || 0,
        activeMonth: mauCount,
        newToday: newUsersToday.count || 0,
        newWeek: newUsersWeek.count || 0,
        newMonth: newUsersMonth.count || 0,
        companies: Object.entries(companyCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      },
      content: {
        tracksTotal: tracksTotal.count || 0,
        tracksActive: tracksActive.count || 0,
        lessonsTotal: lessonsTotal.count || 0,
      },
      engagement: {
        enrollmentsTotal: enrollTotal,
        enrollmentsToday: enrollmentsToday.count || 0,
        enrollmentsWeek: enrollmentsWeek.count || 0,
        enrollmentsMonth: enrollmentsMonth.count || 0,
        enrollmentsCompleted: enrollCompleted,
        lessonsCompletedToday: lessonsCompletedToday.count || 0,
        lessonsCompletedWeek: lessonsCompletedWeek.count || 0,
        quizAttemptsToday: quizAttemptsToday.count || 0,
        quizAttemptsWeek: quizAttemptsWeek.count || 0,
        quizPassedWeek: quizPassedWeek.count || 0,
        quizAttemptsTotal: quizTotal,
        quizPassedTotal: quizPassed,
        forumPostsToday: forumPostsToday.count || 0,
        forumPostsWeek: forumPostsWeek.count || 0,
        coinTransactionsToday: coinTransactionsToday.count || 0,
        badgesEarnedToday: badgesEarnedToday.count || 0,
        badgesEarnedWeek: badgesEarnedWeek.count || 0,
      },
      operations: {
        certificatesTotal: certificatesTotal.count || 0,
        certificatesToday: certificatesToday.count || 0,
        certificatesWeek: certificatesWeek.count || 0,
        trainingRequestsPending: trainingRequestsPending.count || 0,
        trainingRequestsTotal: trainingRequestsTotal.count || 0,
        rewardRedemptionsPending: rewardRedemptionsPending.count || 0,
        notificationsUnread: notificationsUnread.count || 0,
      },
      kpis: {
        dauMauRatio,
        completionRate,
        quizPassRate,
        retentionRate7d,
        retentionRate30d,
        growthRateWeek,
        avgStreak,
        maxStreak,
        activeStreaks,
      },
      activityByDay,
      recentAuditLogs: recentLogs.data || [],
    };

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("system-metrics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
