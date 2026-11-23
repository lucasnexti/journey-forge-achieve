import { useEffect, useRef, useState } from "react";
import { Linkedin, Copy, RotateCcw, ExternalLink, Check, Download, Loader2, Share2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SHARE_INVITE, buildSuggestedPost, linkedInAddToProfileUrl, linkedInComposerUrl } from "@/lib/linkedinShare";
import { renderCertificatePng } from "@/lib/certificateImage";

type Lookup = { trackId: string; certificateId?: never } | { certificateId: string; trackId?: never };

interface Props {
  trainingName: string;
  lookup: Lookup;
  /** Sem moldura de cartão (para uso dentro de uma janela). */
  bare?: boolean;
}

type CertImage = { url: string; file: File; fileName: string };

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const el = document.createElement("textarea");
      el.value = text; el.setAttribute("readonly", ""); el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.select();
      const ok = document.execCommand("copy"); el.remove(); return ok;
    } catch { return false; }
  }
}

function canShareFile(file: File) {
  try { return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }); }
  catch { return false; }
}

/** Convite opcional para compartilhar a imagem do certificado; não interfere no acesso ao certificado. */
const LinkedInAchievementShare = ({ trainingName, lookup, bare = false }: Props) => {
  const [cert, setCert] = useState<{ id: string | null; code: string | null; issuedAt: string | null }>({ id: null, code: null, issuedAt: null });
  const [text, setText] = useState(() => buildSuggestedPost(trainingName));
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [image, setImage] = useState<CertImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const editedRef = useRef(false);
  editedRef.current = edited;

  const key = lookup.trackId ?? lookup.certificateId;
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      let q = supabase.from("certificates").select("id, certificate_code, issued_at, revoked_at");
      q = lookup.certificateId ? q.eq("id", lookup.certificateId) : q.eq("track_id", lookup.trackId!).eq("user_id", auth.user?.id ?? "");
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      const code = data && !data.revoked_at ? data.certificate_code : null;
      if (code) {
        setCert({ id: data!.id, code, issuedAt: data?.issued_at ?? null });
      } else if (!data?.revoked_at && tries++ < 5) {
        // o certificado pode estar sendo emitido neste instante
        timer = setTimeout(load, 3000);
      }
    };
    load();
    if (!editedRef.current) setText(buildSuggestedPost(trainingName));
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, trainingName]);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const suggested = buildSuggestedPost(trainingName);
  const postText = () => text.trim() || suggested;

  const prepare = async () => {
    if (!cert.id) {
      toast.info("Seu certificado ainda está sendo emitido. Tente novamente em alguns segundos.");
      return;
    }
    setPreparing(true);
    try {
      const { blob, file, fileName } = await renderCertificatePng({ certificateId: cert.id, trainingName });
      setImage({ url: URL.createObjectURL(blob), file, fileName });
      setDownloaded(false);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar a imagem do certificado.");
    } finally {
      setPreparing(false);
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url; a.download = image.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setDownloaded(true);
    toast.success("Imagem do certificado baixada.", { description: image.fileName });
  };

  const openLinkedIn = () => {
    const body = postText();
    // abrir antes de copiar evita bloqueio de janela no navegador
    window.open(linkedInComposerUrl(body), "_blank", "noopener,noreferrer");
    copyText(body).then((ok) => {
      toast.success("Abrimos o LinkedIn para você criar a publicação.", {
        description: `Clique no ícone de imagem (Mídia) e anexe o arquivo ${image?.fileName ?? "do certificado"}.${ok ? " O texto também foi copiado, caso precise colar." : ""}`,
        duration: 9000,
      });
    });
  };

  const shareNative = async () => {
    if (!image) return;
    copyText(postText());
    try {
      await navigator.share({ files: [image.file], text: postText(), title: `Certificado — ${trainingName}` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Não foi possível abrir o compartilhamento. Baixe a imagem e anexe no LinkedIn.");
    }
  };

  const copy = async () => {
    const ok = await copyText(postText());
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Texto copiado."); }
    else toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
  };

  const nativeShare = image ? canShareFile(image.file) : false;

  return (
    <section
      aria-label="Compartilhar certificado no LinkedIn"
      className={bare ? "space-y-4" : "card-surface space-y-4 border border-linkedin/20 p-4 sm:p-6"}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linkedin text-linkedin-foreground">
          <Linkedin className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-base font-bold text-foreground">{SHARE_INVITE.title}</h3>
          <p className="text-sm text-muted-foreground">{SHARE_INVITE.body}</p>
          <p className="text-sm font-medium text-foreground">{SHARE_INVITE.question}</p>
        </div>
      </div>

      {!image ? (
        <Button
          onClick={prepare}
          disabled={preparing}
          className="h-11 w-full gap-2 bg-linkedin text-linkedin-foreground hover:bg-linkedin/90"
        >
          {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Linkedin className="h-4 w-4" />}
          {preparing ? "Preparando a imagem do certificado…" : "Compartilhar meu certificado no LinkedIn"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-linkedin/20 bg-linkedin/5 p-3 sm:p-4">
          <figure className="overflow-hidden rounded-md border border-border bg-background">
            <img src={image.url} alt={`Imagem do certificado de ${trainingName}`} className="block h-auto w-full" />
          </figure>

          {nativeShare && (
            <Button onClick={shareNative} className="h-11 w-full gap-2 bg-linkedin text-linkedin-foreground hover:bg-linkedin/90">
              <Share2 className="h-4 w-4" /> Enviar a imagem para o LinkedIn
            </Button>
          )}

          <ol className="space-y-2 text-sm">
            <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground"><strong>1.</strong> Baixe a imagem do seu certificado</span>
              <Button variant="outline" onClick={download} className="h-10 gap-2 sm:w-56">
                {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {downloaded ? "Imagem baixada" : "Baixar imagem (PNG)"}
              </Button>
            </li>
            <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground"><strong>2.</strong> Abra a publicação no LinkedIn</span>
              <Button onClick={openLinkedIn} className="h-10 gap-2 bg-linkedin text-linkedin-foreground hover:bg-linkedin/90 sm:w-56">
                <Linkedin className="h-4 w-4" /> Abrir o LinkedIn
              </Button>
            </li>
            <li className="flex items-start gap-2 text-muted-foreground">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong className="text-foreground">3.</strong> No LinkedIn, clique no ícone de imagem (Mídia), escolha o arquivo <span className="break-all font-medium text-foreground">{image.fileName}</span> e publique.</span>
            </li>
          </ol>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`linkedin-text-${key}`} className="text-xs font-semibold text-foreground">
            Texto sugerido (você pode editar)
          </label>
          {edited && text !== suggested && (
            <button
              type="button"
              onClick={() => { setText(suggested); setEdited(false); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Restaurar sugestão
            </button>
          )}
        </div>
        <Textarea
          id={`linkedin-text-${key}`}
          value={text}
          onChange={(e) => { setText(e.target.value); setEdited(true); }}
          rows={8}
          className="min-h-[160px] resize-y text-sm leading-relaxed"
        />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={copy} className="h-8 gap-1.5 text-xs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copiar texto
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Nada é publicado automaticamente: você revisa e confirma a publicação no LinkedIn.</p>
        <a
          href={linkedInAddToProfileUrl({ name: trainingName, issuedAt: cert.issuedAt, code: cert.code })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-linkedin hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Adicionar ao perfil
        </a>
      </div>
    </section>
  );
};

export default LinkedInAchievementShare;
