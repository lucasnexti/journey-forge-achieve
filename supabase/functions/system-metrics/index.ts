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

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Only robson@nexti.com can access
    if (user.email !== "robson@nexti.com") {
      return new Response(JSON.stringify({ error: "Forbidden — super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Gather metrics in parallel
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profilesCount,
      activeNow,
      activeToday,
      activeWeek,
      enrollmentsTotal,
      enrollmentsToday,
      lessonsCompletedToday,
      lessonsCompletedWeek,
      quizAttemptsToday,
      quizAttemptsWeek,
      forumPostsToday,
      tracksTotal,
      tracksActive,
      lessonsTotal,
      certificatesTotal,
      certificatesToday,
      trainingRequestsPending,
      trainingRequestsTotal,
      notificationsUnread,
      coinTransactionsToday,
      rewardRedemptionsPending,
      badgesEarnedToday,
      companiesData,
      recentLogs,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", fiveMinAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", oneDayAgo),
      admin.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", sevenDaysAgo),
      admin.from("enrollments").select("*", { count: "exact", head: true }),
      admin.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", oneDayAgo),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).eq("completed", true).gte("last_watched_at", oneDayAgo),
      admin.from("lesson_progress").select("*", { count: "exact", head: true }).eq("completed", true).gte("last_watched_at", sevenDaysAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", oneDayAgo),
      admin.from("quiz_attempts").select("*", { count: "exact", head: true }).gte("attempted_at", sevenDaysAgo),
      admin.from("forum_posts").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      admin.from("tracks").select("*", { count: "exact", head: true }),
      admin.from("tracks").select("*", { count: "exact", head: true }).eq("is_active", true),
      admin.from("lessons").select("*", { count: "exact", head: true }),
      admin.from("certificates").select("*", { count: "exact", head: true }),
      admin.from("certificates").select("*", { count: "exact", head: true }).gte("issued_at", oneDayAgo),
      admin.from("training_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("training_requests").select("*", { count: "exact", head: true }),
      admin.from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
      admin.from("coin_transactions").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      admin.from("reward_redemptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("user_badges").select("*", { count: "exact", head: true }).gte("earned_at", oneDayAgo),
      admin.from("profiles").select("empresa").not("empresa", "is", null),
      admin.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    // Company breakdown
    const companyCounts: Record<string, number> = {};
    (companiesData.data || []).forEach((p: any) => {
      companyCounts[p.empresa] = (companyCounts[p.empresa] || 0) + 1;
    });

    const metrics = {
      timestamp: now.toISOString(),
      users: {
        total: profilesCount.count || 0,
        onlineNow: activeNow.count || 0,
        activeToday: activeToday.count || 0,
        activeWeek: activeWeek.count || 0,
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
        enrollmentsTotal: enrollmentsTotal.count || 0,
        enrollmentsToday: enrollmentsToday.count || 0,
        lessonsCompletedToday: lessonsCompletedToday.count || 0,
        lessonsCompletedWeek: lessonsCompletedWeek.count || 0,
        quizAttemptsToday: quizAttemptsToday.count || 0,
        quizAttemptsWeek: quizAttemptsWeek.count || 0,
        forumPostsToday: forumPostsToday.count || 0,
        coinTransactionsToday: coinTransactionsToday.count || 0,
        badgesEarnedToday: badgesEarnedToday.count || 0,
      },
      operations: {
        certificatesTotal: certificatesTotal.count || 0,
        certificatesToday: certificatesToday.count || 0,
        trainingRequestsPending: trainingRequestsPending.count || 0,
        trainingRequestsTotal: trainingRequestsTotal.count || 0,
        rewardRedemptionsPending: rewardRedemptionsPending.count || 0,
        notificationsUnread: notificationsUnread.count || 0,
      },
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
