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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const actions: { slo: string; action: string; status: "fixed" | "alert" | "skipped"; detail: string }[] = [];
    const TARGET_SCORE = 95;

    // ─── 1. Check lessons without descriptions ───
    const { data: lessonsNoDesc } = await admin
      .from("lessons")
      .select("id, title, track_id")
      .or("description.is.null,description.eq.");

    if (lessonsNoDesc && lessonsNoDesc.length > 0) {
      // Get track titles for context
      const trackIds = [...new Set(lessonsNoDesc.map((l: any) => l.track_id))];
      const { data: tracks } = await admin.from("tracks").select("id, title").in("id", trackIds);
      const trackMap = new Map((tracks || []).map((t: any) => [t.id, t.title]));

      for (const lesson of lessonsNoDesc) {
        const trackTitle = trackMap.get(lesson.track_id) || "Trilha";
        const autoDesc = `Aula sobre ${lesson.title} da trilha "${trackTitle}". Assista ao conteúdo completo para aprofundar seus conhecimentos neste tema.`;
        
        const { error } = await admin
          .from("lessons")
          .update({ description: autoDesc })
          .eq("id", lesson.id);

        if (!error) {
          actions.push({
            slo: "Descrição em Aulas > 70%",
            action: "auto_fill_description",
            status: "fixed",
            detail: `Descrição gerada para aula "${lesson.title}"`,
          });
        } else {
          actions.push({
            slo: "Descrição em Aulas > 70%",
            action: "auto_fill_description",
            status: "alert",
            detail: `Falha ao atualizar aula "${lesson.title}": ${error.message}`,
          });
        }
      }
    }

    // ─── 2. Check lessons without video ───
    const { data: lessonsAll } = await admin.from("lessons").select("*", { count: "exact", head: true });
    const { data: lessonsWithVideo } = await admin.from("lessons").select("*", { count: "exact", head: true }).not("video_url", "is", null);
    const totalLessons = (lessonsAll as any)?.count || 0;
    const withVideo = (lessonsWithVideo as any)?.count || 0;
    const videoAvail = totalLessons > 0 ? Math.round((withVideo / totalLessons) * 100) : 100;

    if (videoAvail < 80) {
      // Can't auto-fix missing videos, but alert admin
      const { data: noVideo } = await admin.from("lessons").select("id, title").is("video_url", null).limit(10);
      const lessonNames = (noVideo || []).map((l: any) => l.title).join(", ");
      actions.push({
        slo: "Vídeo Disponível > 80%",
        action: "alert_missing_videos",
        status: "alert",
        detail: `${totalLessons - withVideo} aula(s) sem vídeo: ${lessonNames}`,
      });
    }

    // ─── 3. Check tracks without quizzes ───
    const { data: activeTracks } = await admin.from("tracks").select("id, title").eq("is_active", true);
    const { data: quizzes } = await admin.from("quizzes").select("track_id");
    const tracksWithQuiz = new Set((quizzes || []).map((q: any) => q.track_id));
    const tracksNoQuiz = (activeTracks || []).filter((t: any) => !tracksWithQuiz.has(t.id));
    const quizCoverage = (activeTracks || []).length > 0
      ? Math.round((tracksWithQuiz.size / (activeTracks || []).length) * 100) : 100;

    if (quizCoverage < 50) {
      const names = tracksNoQuiz.map((t: any) => t.title).join(", ");
      actions.push({
        slo: "Cobertura de Quiz > 50%",
        action: "alert_missing_quizzes",
        status: "alert",
        detail: `Trilhas sem quiz: ${names}`,
      });
    }

    // ─── 4. Check tracks without lessons (content completeness) ───
    const { data: lessonsTrackIds } = await admin.from("lessons").select("track_id").limit(1000);
    const tracksWithLessons = new Set((lessonsTrackIds || []).map((l: any) => l.track_id));
    const tracksNoLessons = (activeTracks || []).filter((t: any) => !tracksWithLessons.has(t.id));

    if (tracksNoLessons.length > 0) {
      const names = tracksNoLessons.map((t: any) => t.title).join(", ");
      actions.push({
        slo: "Completude de Conteúdo > 90%",
        action: "alert_empty_tracks",
        status: "alert",
        detail: `Trilhas sem aulas: ${names}`,
      });
    }

    // ─── 5. Check profiles without empresa ───
    const { count: totalProfiles } = await admin.from("profiles").select("*", { count: "exact", head: true });
    const { count: profilesWithEmpresa } = await admin.from("profiles").select("*", { count: "exact", head: true }).not("empresa", "is", null);
    const profileCompleteness = (totalProfiles || 0) > 0
      ? Math.round(((profilesWithEmpresa || 0) / (totalProfiles || 1)) * 100) : 100;

    if (profileCompleteness < 50) {
      actions.push({
        slo: "Perfis Completos > 50%",
        action: "alert_incomplete_profiles",
        status: "alert",
        detail: `${(totalProfiles || 0) - (profilesWithEmpresa || 0)} perfis sem empresa preenchida`,
      });
    }

    // ─── Send notification if any alerts or fixes ───
    const fixes = actions.filter((a) => a.status === "fixed");
    const alerts = actions.filter((a) => a.status === "alert");

    if (fixes.length > 0 || alerts.length > 0) {
      // Notify all admins
      const { data: adminRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminIds = (adminRoles || []).map((r: any) => r.user_id);

      if (adminIds.length > 0) {
        const fixSummary = fixes.length > 0
          ? `✅ ${fixes.length} correção(ões) automática(s) aplicada(s).`
          : "";
        const alertSummary = alerts.length > 0
          ? `⚠️ ${alerts.length} item(ns) precisam de atenção manual.`
          : "";
        const details = actions.map((a) => `• [${a.status.toUpperCase()}] ${a.detail}`).join("\n");

        const notifications = adminIds.map((userId: string) => ({
          user_id: userId,
          title: "🔧 Auto-Heal: Relatório de Saúde do Sistema",
          message: `${fixSummary} ${alertSummary}\n\n${details}`.trim(),
          type: alerts.length > 0 ? "warning" : "info",
        }));

        await admin.from("notifications").insert(notifications);
      }
    }

    // ─── Log to audit_logs ───
    if (actions.length > 0) {
      const { data: firstAdmin } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (firstAdmin) {
        await admin.from("audit_logs").insert({
          user_id: firstAdmin.user_id,
          action: "auto_heal_run",
          entity_type: "system",
          details: {
            total_actions: actions.length,
            fixes: fixes.length,
            alerts: alerts.length,
            actions,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        targetScore: TARGET_SCORE,
        actionsTotal: actions.length,
        fixed: fixes.length,
        alerts: alerts.length,
        skipped: actions.filter((a) => a.status === "skipped").length,
        actions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-heal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
