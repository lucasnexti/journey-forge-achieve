import { openCertificatePdf } from "@/lib/certificates";
import { certificateImageFileName } from "@/lib/linkedinShare";

/** Largura da imagem gerada (px): boa nitidez no feed do LinkedIn sem arquivo pesado. */
const TARGET_WIDTH = 2400;

/**
 * Converte a 1ª página do PDF oficial já emitido em PNG, mantendo o layout original.
 * A geração do PDF continua no backend; aqui só rasterizamos o arquivo do próprio colaborador.
 */
export async function renderCertificatePng(opts: { certificateId?: string; trackId?: string; trainingName: string }) {
  const url = await openCertificatePdf({ certificateId: opts.certificateId, trackId: opts.trackId });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível baixar o certificado.");
  const bytes = new Uint8Array(await res.arrayBuffer());

  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu gerar a imagem do certificado.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem do certificado.");
    const fileName = certificateImageFileName(opts.trainingName);
    return { blob, fileName, file: new File([blob], fileName, { type: "image/png" }) };
  } finally {
    doc.destroy();
  }
}
