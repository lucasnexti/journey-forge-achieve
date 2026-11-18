// Processa a fila de e-mails de Pesquisas e Indicadores (convites, lembretes e avisos de prorrogação).
// Nunca simula sucesso: sem serviço de e-mail configurado ou com envios desligados, os e-mails
// ficam "aguardando configuração" e podem ser reprocessados depois.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { renderResearchEmail, type ResearchEmailJob } from "./render.ts";

const SITE_URL = "https://journey-forge-achieve.lovable.app";
const SEND_FUNCTION = "send-transactional-email";
const TEMPLATE = "research-survey-invite";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  action: z.enum(["tick", "process", "test"]),
  survey_id: z.string().uuid().optional(),
});

type Outcome = { outcome: "sent" | "failed" | "blocked_config"; providerId?: string; error?: string };

async function deliver(url: string, serviceKey: string, job: ResearchEmailJob & { job_id: string; sender_email: string; sender_name: string }, link: string | null): Promise<Outcome> {
  const rendered = renderResearchEmail(job, link);
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/${SEND_FUNCTION}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: TEMPLATE,
        recipientEmail: job.email,
        idempotencyKey: `research-${job.job_id}`,
        templateData: { ...rendered, senderEmail: job.sender_email, senderName: job.sender_name },
      }),
    });
  } catch (e) {
    return { outcome: "failed", error: `Falha de rede ao chamar o serviço de e-mail: ${String(e).slice(0, 200)}` };
  }
  const text = await res.text();
  if (res.status === 404) {
    return { outcome: "blocked_config", error: "Serviço de e-mail não configurado (domínio de envio e modelo de convite pendentes)" };
  }
  if (!res.ok) {
    const transient = res.status >= 500 || res.status === 429;
    return { outcome: transient ? "failed" : "blocked_config", error: `Serviço de e-mail respondeu ${res.status}: ${text.slice(0, 300)}` };
  }
  let providerId: string | undefined;
  try {
    const data = JSON.parse(text);
    providerId = data?.messageId ?? data?.message_id ?? data?.id ?? undefined;
  } catch { /* sem corpo JSON */ }
  return { outcome: "sent", providerId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey);

  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { action, survey_id } = parsed.data;

  let caller: { id: string; email: string } | null = null;
  if (action === "tick") {
    const denied = authenticateCronRequest(req);
    if (denied) return denied;
  } else {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer /, "");
    if (!token) return json({ error: "Não autenticado" }, 401);
    const { data: u, error } = await admin.auth.getUser(token);
    if (error || !u.user) return json({ error: "Não autenticado" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: can } = await userClient.rpc("research_can", { _perm: "surveys_send" });
    if (!can) return json({ error: "Sem permissão para enviar pesquisas" }, 403);
    caller = { id: u.user.id, email: u.user.email ?? "" };
  }

  // Envio de teste controlado: somente para o e-mail de quem pediu, sem criar convite nem link válido.
  if (action === "test") {
    if (!survey_id) return json({ error: "Informe a pesquisa" }, 400);
    const { data: s } = await admin.from("research_surveys").select("id,title,audience,email_subject,email_body,deadline_at,deadline_days").eq("id", survey_id).maybeSingle();
    if (!s) return json({ error: "Pesquisa não encontrada" }, 404);
    const { data: st } = await admin.from("research_settings").select("sender_email,sender_name,sending_enabled").eq("audience", s.audience).maybeSingle();
    if (!st?.sending_enabled) {
      return json({ outcome: "blocked_config", error: "Envios reais estão desligados para este público em Configurações" });
    }
    const result = await deliver(url, serviceKey, {
      job_id: `test-${crypto.randomUUID()}`, kind: "invite", email: caller!.email, name: "Teste",
      title: s.title, subject: `[TESTE] ${s.email_subject}`, body: s.email_body, deadline_at: s.deadline_at,
      sender_email: st.sender_email, sender_name: st.sender_name,
    }, null);
    await admin.from("audit_logs").insert({ user_id: caller!.id, action: "research_test_email", entity_type: "research_surveys", entity_id: s.id, details: { outcome: result.outcome } });
    return json(result);
  }

  let tick: unknown = null;
  if (action === "tick") {
    const { data, error } = await admin.rpc("research_scheduler_tick");
    if (error) return json({ error: error.message }, 500);
    tick = data;
  }

  const summary = { sent: 0, failed: 0, retry: 0, blocked: 0 };
  for (let round = 0; round < 10; round++) {
    const { data: jobs, error } = await admin.rpc("research_claim_email_jobs", { _limit: 50 });
    if (error) return json({ error: error.message }, 500);
    const list = (jobs ?? []) as Array<ResearchEmailJob & { job_id: string; token: string; attempts: number; max_attempts: number; sender_email: string; sender_name: string; sending_enabled: boolean }>;
    if (!list.length) break;
    for (const job of list) {
      const result: Outcome = job.sending_enabled
        ? await deliver(url, serviceKey, job, `${SITE_URL}/pesquisa/${job.token}`)
        : { outcome: "blocked_config", error: "Envios reais estão desligados para este público em Configurações" };
      await admin.rpc("research_complete_email_job", { _job: job.job_id, _outcome: result.outcome, _provider_id: result.providerId ?? null, _error: result.error ?? null });
      if (result.outcome === "sent") summary.sent++;
      else if (result.outcome === "blocked_config") summary.blocked++;
      else if (job.attempts < job.max_attempts) summary.retry++;
      else summary.failed++;
    }
    if (summary.blocked > 0 && summary.sent === 0) break; // serviço indisponível: não insistir nesta rodada
  }
  return json({ ok: true, tick, ...summary });
});
