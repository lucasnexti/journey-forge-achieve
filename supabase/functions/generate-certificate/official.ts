// Layout oficial do certificado Nexti Academy (A4 paisagem), fiel ao modelo Certificado.tsx enviado pela Nexti.
// Coordenadas em px do modelo (1123 × 794) convertidas para pontos PDF.
import { PDFDocument, rgb, PDFFont, PDFName, PDFString } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import QRCode from "npm:qrcode@1.5.4";
import * as A from "./assets.ts";

export type OfficialData = {
  name: string; course?: string; hours?: string; startDate?: string; endDate?: string;
  place?: string; issueDate?: string; code?: string; verifyUrl: string;
  signerName?: string; signerRole?: string;
};

const W = 1123, H = 794;
const PW = 841.89, PH = 595.28, K = PW / W;
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const col = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const C = { laranja: col("#E85224"), laranjaTexto: col("#B93D12"), tinta: col("#1D2129"), cinza: col("#555B66"), linha: col("#D9DCE1"), branco: rgb(1, 1, 1) };
const tem = (v?: string) => !!v && v.trim() !== "";

export async function renderOfficial(d: OfficialData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificado — ${d.name}`); pdf.setAuthor("Nexti Academy");
  const page = pdf.addPage([PW, PH]);
  const F = {
    d800: await pdf.embedFont(b64(A.BRICOLAGE_800), { subset: true }),
    d700: await pdf.embedFont(b64(A.BRICOLAGE_700), { subset: true }),
    r400: await pdf.embedFont(b64(A.FIGTREE_400), { subset: true }),
    r600: await pdf.embedFont(b64(A.FIGTREE_600), { subset: true }),
  };
  const logo = await pdf.embedPng(b64(A.LOGO));
  const sig = await pdf.embedPng(b64(A.SIGNATURE));

  // Helpers em px do modelo (origem no topo).
  const rect = (x: number, y: number, w: number, h: number, color = C.tinta) =>
    page.drawRectangle({ x: x * K, y: (H - y - h) * K, width: w * K, height: h * K, color });
  const tw = (t: string, f: PDFFont, s: number, ls = 0) => f.widthOfTextAtSize(t, s) + ls * s * Math.max(0, t.length - 1);
  // Desenha texto com o topo da caixa de linha em y.
  const text = (t: string, x: number, y: number, f: PDFFont, s: number, color: any, lh = 1.2, ls = 0) => {
    const base = y + (lh * s - s) / 2 + s * 0.8;
    if (!ls) { page.drawText(t, { x: x * K, y: (H - base) * K, size: s * K, font: f, color }); return; }
    let cx = x;
    for (const ch of t) { page.drawText(ch, { x: cx * K, y: (H - base) * K, size: s * K, font: f, color }); cx += f.widthOfTextAtSize(ch, s) + ls * s; }
  };
  const wrap = (t: string, f: PDFFont, s: number, maxW: number) => {
    const lines: string[] = [""];
    for (const w of t.split(/\s+/)) {
      const cur = lines[lines.length - 1]; const nx = cur ? `${cur} ${w}` : w;
      if (cur && tw(nx, f, s) > maxW) lines.push(w); else lines[lines.length - 1] = nx;
    }
    return lines;
  };

  // Faixa institucional laranja inclinada à direita.
  const bx = W - 300;
  page.drawSvgPath(`M ${(bx + 96) * K} 0 L ${PW} 0 L ${PW} ${PH} L ${bx * K} ${PH} Z`, { x: 0, y: PH, color: C.laranja });

  const L = 76, CW = 690;
  // Cabeçalho: logo | ACADEMY
  const logoW = 44 * (logo.width / logo.height);
  page.drawImage(logo, { x: L * K, y: (H - 62 - 44) * K, width: logoW * K, height: 44 * K });
  const divX = L + logoW + 16;
  rect(divX, 62, 1.5, 44, C.linha);
  text("ACADEMY", divX + 1.5 + 16, 62 + (44 - 21 * 1.2) / 2, F.d700, 21, C.tinta, 1.2, 0.14);

  let y = 62 + 44 + 58;
  text("CERTIFICADO DE CONCLUSÃO", L, y, F.r600, 13, C.laranjaTexto, 1.2, 0.2);
  y += 13 * 1.2 + 14; rect(L, y, 44, 3, C.laranja); y += 3;

  y += 30; text("Certificamos que", L, y, F.r400, 17, C.cinza); y += 17 * 1.2;

  const len = d.name.trim().length;
  let ns = len > 40 ? 38 : len > 28 ? 46 : 54;
  let nl = wrap(d.name, F.d800, ns, CW);
  while (nl.length > 2 && ns > 28) { ns -= 2; nl = wrap(d.name, F.d800, ns, CW); }
  y += 8; for (const l of nl) { text(l, L, y, F.d800, ns, C.tinta, 1.05); y += ns * 1.05; }

  if (tem(d.course)) {
    y += 22; text("concluiu com êxito o curso", L, y, F.r400, 17, C.cinza); y += 17 * 1.2;
    y += 6; for (const l of wrap(d.course!, F.d700, 27, 640)) { text(l, L, y, F.d700, 27, C.laranjaTexto, 1.2); y += 27 * 1.2; }
  }

  // Frase de carga horária + período, com trechos em destaque.
  const segs: { t: string; b?: boolean }[] = [];
  if (tem(d.hours)) { const h = d.hours!.trim(); segs.push({ t: "com carga horária de " }, { t: `${h} ${h === "1" ? "hora" : "horas"}`, b: true }); }
  if (tem(d.startDate) && tem(d.endDate)) {
    if (segs.length) segs.push({ t: ", " });
    segs.push({ t: "realizado no período de " }, { t: d.startDate!, b: true }, { t: " a " }, { t: d.endDate!, b: true });
  } else if (tem(d.endDate)) {
    if (segs.length) segs.push({ t: ", " });
    segs.push({ t: "concluído em " }, { t: d.endDate!, b: true });
  }
  if (segs.length) {
    segs.push({ t: "." });
    y += 18;
    const words: { t: string; b?: boolean; sp: boolean }[] = [];
    for (const s of segs) s.t.split(/(\s+)/).forEach((p) => { if (!p) return; if (/^\s+$/.test(p)) { if (words.length) words[words.length - 1].sp = true; } else words.push({ t: p, b: s.b, sp: false }); });
    const s = 16, lh = 1.55, maxW = 600, spW = tw(" ", F.r400, s);
    let x = L;
    for (const w of words) {
      const f = w.b ? F.r600 : F.r400; const ww = tw(w.t, f, s);
      if (x > L && x + ww > L + maxW) { x = L; y += s * lh; }
      text(w.t, x, y, f, s, w.b ? C.tinta : C.cinza, lh);
      x += ww + (w.sp ? spW : 0);
    }
    y += s * lh;
  }

  // Rodapé: assinatura (esquerda) e local/data (direita), alinhados à base 737.
  const bottom = H - 57;
  const sigTop = bottom - (64 + 6 + 1.25 + 9 + 15 * 1.2 + (tem(d.signerRole) ? 1 + 13 * 1.2 : 0));
  const sh = Math.min(64, 260 * sig.height / sig.width), sw = sh * sig.width / sig.height;
  page.drawImage(sig, { x: L * K, y: (H - sigTop - 64) * K, width: sw * K, height: sh * K, opacity: 0.9 });
  let fy = sigTop + 64 + 6; rect(L, fy, 290, 1.25, C.tinta); fy += 1.25 + 9;
  text(d.signerName || "Marcelo Araújo Gomes", L, fy, F.r600, 15, C.tinta); fy += 15 * 1.2;
  if (tem(d.signerRole)) text(d.signerRole!, L, fy + 1, F.r400, 13, C.cinza);

  const emissao = [d.place, d.issueDate].filter(tem).join(", ");
  if (emissao) {
    const lines = wrap(`Local e data de emissão: ${emissao}.`, F.r400, 13, 340);
    let ey = bottom - 2 - lines.length * 13 * 1.5;
    for (const l of lines) { text(l, L + CW - tw(l, F.r400, 13), ey, F.r400, 13, C.cinza, 1.5); ey += 13 * 1.5; }
  }

  // Cartão de validação com QR Code (132 px ≈ 35 mm impresso).
  const cardW = 172, pad = 14, q = 132;
  const note = wrap("Escaneie para validar a autenticidade deste certificado", F.r400, 10, cardW - 2 * pad);
  const codeLines = tem(d.code) ? wrap(`Código: ${d.code}`, F.r600, 11, cardW - 2 * pad) : [];
  const cardH = pad + q + (codeLines.length ? 10 + codeLines.length * 11 * 1.2 : 0) + 4 + note.length * 10 * 1.35 + 12;
  const cx = W - 57 - cardW, cy = bottom - cardH;
  page.drawSvgPath(roundRect(cx * K, cy * K, cardW * K, cardH * K, 8 * K), { x: 0, y: PH, color: C.branco });
  const qr = QRCode.create(d.verifyUrl, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, quiet = 0, cell = q / (n + quiet * 2);
  const qx = cx + (cardW - q) / 2, qy = cy + pad;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.modules.get(r, c)) rect(qx + (c + quiet) * cell, qy + (r + quiet) * cell, cell + 0.05, cell + 0.05, C.tinta);
  }
  let ty = qy + q;
  if (codeLines.length) { ty += 10; for (const l of codeLines) { text(l, cx + (cardW - tw(l, F.r600, 11)) / 2, ty, F.r600, 11, C.tinta); ty += 11 * 1.2; } }
  ty += 4; for (const l of note) { text(l, cx + (cardW - tw(l, F.r400, 10)) / 2, ty, F.r400, 10, C.cinza, 1.35); ty += 10 * 1.35; }

  // Link clicável sobre o QR Code (útil no PDF digital).
  const link = pdf.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [qx * K, (H - qy - q) * K, (qx + q) * K, (H - qy) * K], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(d.verifyUrl) },
  });
  page.node.set(PDFName.of("Annots"), pdf.context.obj([pdf.context.register(link)]));
  return await pdf.save();
}

// Caminho SVG de retângulo arredondado (coordenadas com origem no topo, como o drawSvgPath).
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}
