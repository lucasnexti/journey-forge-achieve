import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PLAYER = /^https:\/\/player\.jmvstream\.com\/[A-Za-z0-9_-]{11,40}\/[A-Za-z0-9_-]{11,40}\/?(\?.*)?$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = await sb.auth.getUser(token);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { url } = await req.json().catch(() => ({}));
    if (typeof url !== "string" || !PLAYER.test(url.trim())) return json({ error: "invalid_url" }, 400);

    const page = await (await fetch(url.trim())).text();
    const master = page.match(/https:\/\/cdn\.vod\.[a-z0-9.]*jmvstream\.com\/[^"'\s<>]+\.m3u8[^"'\s<>]*/)?.[0];
    if (!master) return json({ duration: null });
    const mText = await (await fetch(master)).text();
    let list = mText;
    if (!mText.includes("#EXTINF")) {
      const child = mText.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
      if (!child) return json({ duration: null });
      list = await (await fetch(new URL(child, master).toString())).text();
    }
    let s = 0;
    for (const m of list.matchAll(/#EXTINF:([\d.]+)/g)) s += Number(m[1]);
    return json({ duration: s > 0 ? Math.round(s) : null });
  } catch (e) {
    console.error(e);
    return json({ duration: null });
  }
});
