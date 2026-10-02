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
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  let body;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    return json({ error: "Dados inválidos", details: String(e) }, 400);
  }

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

  await admin.from("user_roles").delete().eq("user_id", newId);
  await admin.from("user_roles").insert({ user_id: newId, role: body.role });

  await admin.from("audit_logs").insert({
    user_id: userData.user.id,
    action: "invite_user",
    entity_type: "profile",
    entity_id: newId,
    details: { email: body.email, role: body.role },
  });

  return json({ user: { id: newId, email: body.email } });
});
