import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const schema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  empresa: z.string().trim().max(100).optional().nullable(),
  cargo: z.string().trim().max(100).optional().nullable(),
  role: z.enum(["user", "moderator", "admin"]).default("user"),
  redirectTo: z.string().url().optional(),
  // Ambiente do colaborador. Só o Master escolhe outro ambiente; os demais usam o próprio.
  company_id: z.string().uuid().optional().nullable(),
  env_role: z.enum(["admin", "member"]).default("member"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Only authenticated admins may invite users
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "Não autenticado" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
  const callerId = userData.user.id;

  let body;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    return json({ error: "Dados inválidos", details: String(e) }, 400);
  }

  const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
  const isMaster = (callerRoles ?? []).some((r) => r.role === "master");
  const { data: callerMembership } = await admin.from("learning_company_memberships")
    .select("company_id, role").eq("user_id", callerId).is("revoked_at", null).maybeSingle();
  const companyId = isMaster && body.company_id ? body.company_id : callerMembership?.company_id;
  if (!companyId) return json({ error: "Seu usuário não está em nenhum ambiente" }, 403);
  if (!isMaster && callerMembership?.role !== "admin") return json({ error: "Acesso restrito a administradores do ambiente" }, 403);
  // Papel global "admin"/"moderator" (ferramentas da Nexti) só o Master concede
  if (!isMaster) body.role = "user";

  const { data: existing } = await admin.from("profiles").select("user_id").ilike("email", body.email).maybeSingle();
  if (existing) return json({ error: "Já existe um usuário com este e-mail" }, 400);

  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { nome: body.nome, empresa: body.empresa ?? "", cargo: body.cargo ?? "" },
    redirectTo: body.redirectTo ? `${new URL(body.redirectTo).origin}/reset-password` : undefined,
  });
  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? "Já existe um usuário com este e-mail"
      : error.message;
    return json({ error: msg }, 400);
  }

  const newId = data.user.id;
  await admin.from("profiles").update({
    nome: body.nome, email: body.email, empresa: body.empresa || null, cargo: body.cargo || null, is_active: true,
  }).eq("user_id", newId);

  await admin.from("user_roles").delete().eq("user_id", newId).in("role", ["admin", "moderator", "user"]);
  await admin.from("user_roles").insert({ user_id: newId, role: body.role });

  // Coloca o colaborador no ambiente certo (o cadastro automático o coloca na Nexti)
  await admin.from("learning_company_memberships").update({ revoked_at: new Date().toISOString() })
    .eq("user_id", newId).neq("company_id", companyId).is("revoked_at", null);
  const { error: memberErr } = await admin.from("learning_company_memberships").upsert({
    user_id: newId, company_id: companyId, role: body.env_role, revoked_at: null,
    validated_by: callerId, validated_at: new Date().toISOString(),
  }, { onConflict: "user_id,company_id" });
  if (memberErr) return json({ error: "Usuário convidado, mas não foi possível vinculá-lo ao ambiente" }, 500);

  await admin.from("audit_logs").insert({
    user_id: userData.user.id,
    action: "invite_user",
    entity_type: "profile",
    entity_id: newId,
    details: { email: body.email, role: body.role, company_id: companyId, env_role: body.env_role },
  });

  return json({ user: { id: newId, email: body.email } });
});
