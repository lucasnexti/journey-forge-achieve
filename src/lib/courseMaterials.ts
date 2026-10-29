import { supabase } from "@/integrations/supabase/client";

export const MATERIAL_BUCKET = "course-materials";
export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

export const MATERIAL_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
};

export const MATERIAL_ACCEPT = Object.keys(MATERIAL_TYPES).map((e) => `.${e}`).join(",");

export function fileExt(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

/** Returns an error message, or null if the file is acceptable. */
export function validateMaterialFile(file: { name: string; size: number; type: string }): string | null {
  const ext = fileExt(file.name);
  const expected = MATERIAL_TYPES[ext];
  if (!expected) return `Formato .${ext || "?"} não permitido. Use PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT ou CSV.`;
  // Browsers sometimes report an empty type or octet-stream for Office files; reject only real mismatches.
  if (file.type && file.type !== "application/octet-stream" && file.type !== expected) {
    return "O conteúdo do arquivo não corresponde à extensão.";
  }
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > MATERIAL_MAX_BYTES) return "O arquivo passa do limite de 50 MB.";
  return null;
}

/** Upload with real progress reporting (XHR against the storage API). */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Falha de conexão durante o envio."));
    xhr.send(file);
  });
}

/** Temporary signed link (10 min) so private files are never exposed permanently. */
export async function getMaterialLink(path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(path, 600, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
