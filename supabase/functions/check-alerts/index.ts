import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Get active alert rules
    const { data: rules, error: rulesErr } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ triggered: 0, message: "No active rules" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Collect current metric values
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const [
      { count: onlineNow },
      { count: certificatesPending },
      { count: trainingPending },
      { count: redemptionsPending },
      { count: lessonsToday },
      { count: enrollmentsToday },
      { count: unreadNotifications },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", fiveMinAgo),
      supabase.from("certificates").select("*", { count: "exact", head: true }), // total certificates as proxy
      supabase.from("training_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reward_redemptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("lesson_progress").select("*", { count: "exact", head: true }).gte("last_watched_at", today).eq("completed", true),
      supabase.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", today),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
    ]);

    const metricValues: Record<string, number> = {
      users_online: onlineNow || 0,
      training_pending: trainingPending || 0,
      redemptions_pending: redemptionsPending || 0,
      lessons_completed_today: lessonsToday || 0,
      enrollments_today: enrollmentsToday || 0,
      unread_notifications: unreadNotifications || 0,
      certificates_total: certificatesPending || 0,
    };

    // 3. Check each rule
    let triggered = 0;
    const alerts: { rule_id: string; metric_key: string; value: number; threshold: number }[] = [];

    for (const rule of rules) {
      const value = metricValues[rule.metric_key];
      if (value === undefined) continue;

      let isTriggered = false;
      switch (rule.operator) {
        case "gte": isTriggered = value >= rule.threshold; break;
        case "lte": isTriggered = value <= rule.threshold; break;
        case "eq": isTriggered = value === rule.threshold; break;
      }

      if (!isTriggered) continue;

      // Check cooldown: was this rule triggered recently?
      const cooldownTime = new Date(now.getTime() - rule.cooldown_minutes * 60 * 1000).toISOString();
      const { count: recentAlerts } = await supabase
        .from("alert_history")
        .select("*", { count: "exact", head: true })
        .eq("rule_id", rule.id)
        .gte("triggered_at", cooldownTime);

      if ((recentAlerts || 0) > 0) continue;

      alerts.push({
        rule_id: rule.id,
        metric_key: rule.metric_key,
        value,
        threshold: rule.threshold,
      });
    }

    // 4. Create notifications and history for triggered alerts
    // Find the super admin user
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(100);

    // Get admin user IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminUserIds = (adminRoles || []).map((r) => r.user_id);

    for (const alert of alerts) {
      const rule = rules.find((r) => r.id === alert.rule_id);
      if (!rule) continue;

      const operatorText = rule.operator === "gte" ? "≥" : rule.operator === "lte" ? "≤" : "=";

      // Create notification for each admin
      for (const adminId of adminUserIds) {
        const { data: notif } = await supabase
          .from("notifications")
          .insert({
            user_id: adminId,
            title: `⚠️ Alerta: ${rule.metric_label}`,
            message: `A métrica "${rule.metric_label}" atingiu ${alert.value} (limite: ${operatorText} ${alert.threshold}).`,
            type: "alert",
          })
          .select("id")
          .single();

        // Log in alert history
        await supabase.from("alert_history").insert({
          rule_id: alert.rule_id,
          metric_key: alert.metric_key,
          metric_value: alert.value,
          threshold: alert.threshold,
          notification_id: notif?.id || null,
        });
      }

      triggered++;
    }

    return new Response(
      JSON.stringify({ triggered, checked: rules.length, metrics: metricValues }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
