import { supabase } from "@/integrations/supabase/client";

export const CERT_FIELD_KEYS = [
  { key: "student_name", label: "Nome do aluno" },
  { key: "course", label: "Nome do curso" },
  { key: "completion_date", label: "Data de conclusão" },
  { key: "hours", label: "Carga horária" },
  { key: "instructor", label: "Instrutor" },
  { key: "code", label: "Código de validação" },
  { key: "verify_url", label: "Link de validação" },
  { key: "institution", label: "Instituição (Nexti Academy)" },
] as const;

export const CERT_FONTS = ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Times-Italic", "Courier"];

export interface CertField {
  key: string; x: number; y: number; size: number; font: string;
  color: string; align: "left" | "center" | "right"; maxWidth: number;
}

export const defaultField = (key: string, i: number): CertField => ({
  key, x: 0.5, y: 0.35 + i * 0.08, size: key === "student_name" ? 28 : 14,
  font: key === "student_name" ? "Times-Bold" : "Helvetica", color: "#222222", align: "center", maxWidth: 0.7,
});

/** Gera (ou reaproveita) o PDF oficial e devolve uma URL temporária para abrir/baixar. */
export async function openCertificatePdf(opts: { certificateId?: string; trackId?: string; force?: boolean; download?: boolean }) {
  const { data, error } = await supabase.functions.invoke("generate-certificate", {
    body: { certificate_id: opts.certificateId, track_id: opts.trackId, force: opts.force, origin: window.location.origin },
  });
  if (error || !data?.file_path) {
    let msg = (data as any)?.error;
    try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
    throw new Error(msg || "Não foi possível gerar o certificado.");
  }
  const { data: signed, error: sErr } = await supabase.storage
    .from("certificates")
    .createSignedUrl(data.file_path, 600, opts.download ? { download: "certificado-nexti-academy.pdf" } : undefined);
  if (sErr || !signed) throw new Error("Não foi possível abrir o certificado.");
  return signed.signedUrl;
}
