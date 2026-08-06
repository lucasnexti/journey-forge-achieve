/**
 * Teste de carga — LMA Universidade Nexti
 *
 * Simula usuários simultâneos com distribuição realista:
 *   60% assistindo vídeo (gravação periódica de progresso)
 *   25% navegando por cursos/aulas (leituras)
 *   15% em prova (start + salvamento + consulta de histórico)
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_JWT=<access_token>
 *   node scripts/load-test.mjs --users 1000 --duration 120 --ramp 60
 *
 * ATENÇÃO: não executar contra produção sem autorização explícita.
 * O TEST_JWT deve ser de um usuário de teste; as rotas respeitam RLS.
 */

const args = Object.fromEntries(
  process.argv.slice(2).join(" ").split("--").filter(Boolean).map((s) => s.trim().split(/\s+/))
);

const URL_BASE = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT = process.env.TEST_JWT || ANON;
const USERS = Number(args.users ?? 1000);
const DURATION = Number(args.duration ?? 120); // segundos de carga sustentada
const RAMP = Number(args.ramp ?? 60); // segundos de crescimento gradual

if (!URL_BASE || !ANON) {
  console.error("Defina SUPABASE_URL e SUPABASE_ANON_KEY.");
  process.exit(1);
}

const MIX = [
  { name: "video", weight: 0.6 },
  { name: "browse", weight: 0.25 },
  { name: "exam", weight: 0.15 },
];

const samples = []; // { op, ms, ok }
const headers = { apikey: ANON, Authorization: `Bearer ${JWT}`, "Content-Type": "application/json" };

async function timed(op, fn) {
  const t0 = performance.now();
  let ok = true;
  try {
    const res = await fn();
    ok = res.ok;
    await res.arrayBuffer();
  } catch {
    ok = false;
  }
  samples.push({ op, ms: performance.now() - t0, ok });
}

const rest = (path) => fetch(`${URL_BASE}/rest/v1/${path}`, { headers });
const rpc = (fn, body) =>
  fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });

async function scenarioBrowse() {
  await timed("browse:tracks", () => rest("tracks?select=id,title,category&is_active=eq.true&order=order_index"));
  await timed("browse:lessons", () => rest("lessons?select=id,title,duration&order=order_index&limit=50"));
}

async function scenarioVideo() {
  await timed("video:progress_read", () => rest("lesson_progress?select=lesson_id,completed,watched_seconds&limit=50"));
  // Uma gravação a cada 30s de vídeo (mesmo intervalo do player)
  await timed("video:progress_write", () =>
    fetch(`${URL_BASE}/rest/v1/lesson_progress?on_conflict=user_id,lesson_id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ watched_seconds: Math.floor(Math.random() * 600) }),
    })
  );
}

async function scenarioExam() {
  await timed("exam:history", () => rest("exam_attempts?select=percent,passed,created_at&order=created_at.desc&limit=20"));
  await timed("exam:start", () => rpc("start_exam_attempt", { _track_id: process.env.TEST_TRACK_ID ?? null }));
}

function pickScenario() {
  const r = Math.random();
  let acc = 0;
  for (const m of MIX) {
    acc += m.weight;
    if (r <= acc) return m.name;
  }
  return "browse";
}

async function virtualUser(stopAt) {
  while (Date.now() < stopAt) {
    const s = pickScenario();
    if (s === "video") await scenarioVideo();
    else if (s === "exam") await scenarioExam();
    else await scenarioBrowse();
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 4000)); // think time
  }
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function report() {
  const total = samples.length;
  const errors = samples.filter((s) => !s.ok).length;
  const byOp = {};
  for (const s of samples) (byOp[s.op] ??= []).push(s.ms);

  console.log(`\n=== Resultado (${USERS} usuários virtuais / ${DURATION}s) ===`);
  console.log(`Requisições: ${total} | Erros: ${errors} (${((errors / total) * 100).toFixed(2)}%)`);
  console.log(`Throughput: ${(total / DURATION).toFixed(1)} req/s\n`);
  console.log("operação".padEnd(24), "n".padStart(6), "p50".padStart(8), "p95".padStart(8), "p99".padStart(8));
  for (const [op, ms] of Object.entries(byOp)) {
    console.log(
      op.padEnd(24),
      String(ms.length).padStart(6),
      `${pct(ms, 50).toFixed(0)}ms`.padStart(8),
      `${pct(ms, 95).toFixed(0)}ms`.padStart(8),
      `${pct(ms, 99).toFixed(0)}ms`.padStart(8)
    );
  }
  const all = samples.map((s) => s.ms);
  console.log(`\nGeral  p50=${pct(all, 50).toFixed(0)}ms  p95=${pct(all, 95).toFixed(0)}ms  p99=${pct(all, 99).toFixed(0)}ms`);
  console.log(`Critérios: p95 APIs < 500ms | p95 provas < 1000ms | erros < 1%`);
}

// Fases: aquecimento → rampa → carga sustentada → pico → recuperação
const SPIKE_USERS = Number(args.spike ?? Math.round(USERS * 0.3));
const SPIKE_DURATION = Number(args.spikeDuration ?? 30);
const RECOVERY = Number(args.recovery ?? 30);

function phaseReport(label, from) {
  const slice = samples.slice(from);
  const ms = slice.map((s) => s.ms);
  const err = slice.filter((s) => !s.ok).length;
  console.log(
    `${label.padEnd(14)} n=${String(slice.length).padStart(6)}  p50=${pct(ms, 50).toFixed(0)}ms  ` +
      `p95=${pct(ms, 95).toFixed(0)}ms  p99=${pct(ms, 99).toFixed(0)}ms  erros=${((err / (slice.length || 1)) * 100).toFixed(2)}%`
  );
}

(async () => {
  // Aquecimento (conexões/planos quentes, fora das métricas comparativas)
  await scenarioBrowse();

  const marks = {};
  marks.load = samples.length;
  const stopAt = Date.now() + (RAMP + DURATION) * 1000;
  const tasks = [];
  for (let i = 0; i < USERS; i++) {
    const delay = (i / USERS) * RAMP * 1000; // crescimento gradual
    tasks.push(new Promise((r) => setTimeout(r, delay)).then(() => virtualUser(stopAt)));
  }
  await Promise.all(tasks);

  // Pico repentino: usuários extras entrando de uma vez
  marks.spike = samples.length;
  const spikeStop = Date.now() + SPIKE_DURATION * 1000;
  await Promise.all(Array.from({ length: SPIKE_USERS }, () => virtualUser(spikeStop)));

  // Recuperação após o pico
  marks.recovery = samples.length;
  const recStop = Date.now() + RECOVERY * 1000;
  await Promise.all(Array.from({ length: Math.round(USERS * 0.2) }, () => virtualUser(recStop)));

  report();
  console.log("\n=== Por fase ===");
  phaseReport("carga", marks.load);
  phaseReport("pico", marks.spike);
  phaseReport("recuperação", marks.recovery);
})();
