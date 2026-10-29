import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { renderOfficial } from "./official.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Field = {
  key: string; x: number; y: number; size: number; font: string;
  color: string; align: "left" | "center" | "right"; maxWidth: number;
};

const FONTS: Record<string, StandardFonts> = {
  "Helvetica": StandardFonts.Helvetica,
  "Helvetica-Bold": StandardFonts.HelveticaBold,
  "Times-Roman": StandardFonts.TimesRoman,
  "Times-Bold": StandardFonts.TimesRomanBold,
  "Times-Italic": StandardFonts.TimesRomanItalic,
  "Courier": StandardFonts.Courier,
};

const hex = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  const n = m ? parseInt(m[1], 16) : 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

async function render(templateBytes: Uint8Array, fields: Field[], values: Record<string, string>) {
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  const cache: Record<string, any> = {};
  for (const f of fields) {
    const text = values[f.key];
    if (!text) continue;
    const fontName = FONTS[f.font] ? f.font : "Helvetica";
    cache[fontName] ??= await pdf.embedFont(FONTS[fontName]);
    const font = cache[fontName];
    const maxW = Math.max(0.05, Math.min(1, f.maxWidth || 0.8)) * width;
    // Long text (e.g. names) shrinks to fit the available space; below 60% it wraps into two lines.
    let size = Math.max(4, f.size || 18);
    const minSize = size * 0.6;
    while (font.widthOfTextAtSize(text, size) > maxW && size > minSize) size -= 0.5;
    let lines = [text];
    if (font.widthOfTextAtSize(text, size) > maxW) {
      const words = text.split(" ");
      lines = [""];
      for (const w of words) {
        const cur = lines[lines.length - 1];
        const next = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > maxW && cur) lines.push(w); else lines[lines.length - 1] = next;
      }
    }
    const baseY = height - f.y * height;
    lines.forEach((line, i) => {
      const tw = font.widthOfTextAtSize(line, size);
      const cx = f.x * width;
      const x = f.align === "center" ? cx - tw / 2 : f.align === "right" ? cx - tw : cx;
      page.drawText(line, { x, y: baseY - i * size * 1.2, size, font, color: hex(f.color) });
    });
  }
  return await pdf.save();
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }) : "";
const fmtLong = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }) : "";
const OFFICIAL_ORIGIN = "https://journey-forge-achieve.lovable.app";
const verifyUrl = (code: string) => `${OFFICIAL_ORIGIN}/validar-certificado/${encodeURIComponent(code)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Não autenticado" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const origin = typeof body.origin === "string" && /^https:\/\//.test(body.origin) ? body.origin : "https://journey-forge-achieve.lovable.app";

  // ── Prévia do modelo (admin): dados de exemplo, nada é salvo ──
  if (body.mode === "preview_official") {
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);
    const out = await renderOfficial({
      name: "Maria Aparecida dos Santos Oliveira", course: "Compliance Trabalhista na Gestão de Equipes",
      hours: "8", startDate: fmtLong("2026-01-16T12:00:00Z"), endDate: fmtLong("2026-02-20T12:00:00Z"),
      place: "São Paulo", issueDate: fmtLong(new Date().toISOString()), code: "ABC123XYZ9",
      verifyUrl: verifyUrl("ABC123XYZ9"), signerName: "Marcelo Araújo Gomes", signerRole: "CEO",
    });
    return new Response(out, { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
  }
  if (body.mode === "preview") {
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);
    const { data: tpl } = await admin.from("certificate_templates").select("file_path").eq("id", body.template_id).maybeSingle();
    if (!tpl) return json({ error: "Modelo não encontrado" }, 404);
    const { data: file, error } = await admin.storage.from("certificates").download(tpl.file_path);
    if (error || !file) return json({ error: "Não foi possível ler o modelo" }, 500);
    const out = await render(new Uint8Array(await file.arrayBuffer()), body.fields || [], {
      student_name: "Maria Aparecida dos Santos Oliveira",
      course: "Nome do Curso de Exemplo",
      completion_date: fmtDate(new Date().toISOString()),
      hours: "8 horas",
      instructor: "Nome do Instrutor",
      code: "ABC123XYZ9",
      institution: "Nexti Academy",
      verify_url: `${origin}/verificar/ABC123XYZ9`,
    });
    return new Response(out, { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
  }

  // ── Emissão do certificado oficial ──
  let q = admin.from("certificates").select("*");
  if (body.certificate_id) q = q.eq("id", body.certificate_id);
  else if (body.track_id) q = q.eq("track_id", body.track_id).eq("user_id", user.id);
  else return json({ error: "Certificado não informado" }, 400);
  const { data: cert } = await q.maybeSingle();
  // O registro só existe quando o backend validou a conclusão (prova aprovada / curso sem prova concluído).
  if (!cert) return json({ error: "Certificado não disponível para este curso" }, 404);
  if (cert.user_id !== user.id && !isAdmin) return json({ error: "Acesso negado" }, 403);
  if (cert.revoked_at) return json({ error: "Certificado revogado" }, 410);

  const force = !!body.force && isAdmin;
  if (cert.file_path && cert.status === "issued" && !force) {
    return json({ ok: true, certificate_id: cert.id, file_path: cert.file_path, reused: true });
  }

  const fail = async (msg: string, status = 422) => {
    await admin.from("certificates").update({ status: "failed", generation_error: msg }).eq("id", cert.id);
    return json({ error: msg }, status);
  };

  const [{ data: profile }, { data: track }, { data: enrollment }, { data: templates }] = await Promise.all([
    admin.from("profiles").select("nome").eq("user_id", cert.user_id).maybeSingle(),
    admin.from("tracks").select("title, estimated_hours, instructor").eq("id", cert.track_id).maybeSingle(),
    admin.from("enrollments").select("completed_at, enrolled_at").eq("user_id", cert.user_id).eq("track_id", cert.track_id).maybeSingle(),
    admin.from("certificate_templates").select("*").eq("is_active", true).order("updated_at", { ascending: false }),
  ]);

  const name = (profile?.nome || "").trim().replace(/\s+/g, " ");
  if (name.split(" ").length < 2 || name.includes("@")) {
    return fail("Nome completo do aluno ausente ou incompleto no cadastro. Corrija o cadastro antes de emitir.");
  }
  // Modelo enviado pelo admin só é usado quando vinculado explicitamente ao curso; senão, layout oficial Nexti.
  const tpl = (templates || []).find((t: any) => (t.track_ids || []).includes(cert.track_id)) || null;
  const code = cert.certificate_code || "";
  let out: Uint8Array;
  try {
    if (tpl) {
      const { data: file, error: dlErr } = await admin.storage.from("certificates").download(tpl.file_path);
      if (dlErr || !file) return fail("Não foi possível ler o modelo do certificado.", 500);
      const hours = track?.estimated_hours ? `${Number(track.estimated_hours).toLocaleString("pt-BR")} horas` : "";
      out = await render(new Uint8Array(await file.arrayBuffer()), tpl.fields || [], {
        student_name: name, course: track?.title || "", completion_date: fmtDate(enrollment?.completed_at || cert.issued_at),
        hours, instructor: track?.instructor || "", code, institution: "Nexti Academy", verify_url: verifyUrl(code),
      });
    } else {
      out = await renderOfficial({
        name, course: track?.title || "",
        hours: track?.estimated_hours ? Number(track.estimated_hours).toLocaleString("pt-BR") : "",
        startDate: fmtLong(enrollment?.enrolled_at), endDate: fmtLong(enrollment?.completed_at || cert.issued_at),
        place: "São Paulo", issueDate: fmtLong(new Date().toISOString()), code, verifyUrl: verifyUrl(code),
        signerName: "Marcelo Araújo Gomes", signerRole: "CEO",
      });
    }
  } catch (e) {
    return fail(`Falha ao gerar o PDF: ${(e as Error).message}`, 500);
  }

  const path = `issued/${cert.user_id}/${cert.id}.pdf`;
  const { error: upErr } = await admin.storage.from("certificates").upload(path, out, { contentType: "application/pdf", upsert: true });
  if (upErr) return fail("Falha ao salvar o PDF do certificado.", 500);

  await admin.from("certificates").update({
    status: "issued", file_path: path, template_id: tpl?.id ?? null, generated_at: new Date().toISOString(),
    generation_error: null, generation_count: (cert.generation_count || 0) + 1,
  }).eq("id", cert.id);

  if (force) {
    await admin.from("audit_logs").insert({
      user_id: user.id, action: "reissue_certificate", entity_type: "certificate", entity_id: cert.id,
      details: { code: cert.certificate_code, template_id: tpl?.id ?? "oficial" },
    });
  }
  return json({ ok: true, certificate_id: cert.id, file_path: path });
});
