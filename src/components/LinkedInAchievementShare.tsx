import { useEffect, useRef, useState } from "react";
import { Linkedin, Copy, RotateCcw, ExternalLink, Check, Download, Loader2, Share2, Lightbulb, ChevronDown } from "lucide-react";
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

const SHARE_STEPS = [
  { title: "Baixe seu certificado:", text: 'clique em "Baixar imagem do certificado" e salve a imagem no seu dispositivo.' },
  { title: "Abra o LinkedIn:", text: 'clique em "Compartilhar minha conquista no LinkedIn".' },
  { title: "Anexe a imagem:", text: "na tela de publicação do LinkedIn, clique no ícone de mídia (foto) e selecione a imagem do certificado que você acabou de baixar." },
  { title: "Compartilhe sua conquista:", text: "revise o texto sugerido, faça os ajustes que desejar e clique em publicar." },
] as const;

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

  const prepare = async (): Promise<CertImage | null> => {
    if (image) return image;
    if (!cert.id) {
      toast.info("Seu certificado ainda está sendo emitido. Tente novamente em alguns segundos.");
      return null;
    }
    setPreparing(true);
    try {
      const { blob, file, fileName } = await renderCertificatePng({ certificateId: cert.id, trainingName });
      const ready = { url: URL.createObjectURL(blob), file, fileName };
      setImage(ready);
      setDownloaded(false);
      return ready;
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar a imagem do certificado.");
      return null;
    } finally {
      setPreparing(false);
    }
  };

  const download = async () => {
    const img = await prepare();
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url; a.download = img.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setDownloaded(true);
    toast.success("Imagem do certificado baixada.", { description: img.fileName });
  };

  const openLinkedIn = () => {
    const body = postText();
    // abrir antes de qualquer espera evita bloqueio de janela no navegador
    window.open(linkedInComposerUrl(body), "_blank", "noopener,noreferrer");
    copyText(body).then((ok) => {
      toast.success("Abrimos o LinkedIn para você criar a publicação.", {
        description: `Clique no ícone de mídia (foto) e anexe a imagem do certificado antes de publicar.${ok ? " O texto também foi copiado, caso precise colar." : ""}`,
        duration: 9000,
      });
    });
    // deixa a imagem pronta na tela para baixar, caso ainda não tenha sido gerada
    if (!image && !preparing && cert.id) void prepare();
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
      className={bare ? "min-w-0 space-y-4" : "min-w-0 card-surface space-y-4 border border-linkedin/20 p-4 sm:p-6"}
    >
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Linkedin className="h-5 w-5 shrink-0 text-linkedin" aria-hidden="true" />
          {SHARE_INVITE.title}
        </h3>
        <p className="text-sm text-muted-foreground">{SHARE_INVITE.body}</p>
        <p className="text-sm font-semibold text-foreground">{SHARE_INVITE.question}</p>
      </div>

      {(image || preparing) && (
        <figure className="overflow-hidden rounded-md border border-border bg-background">
          {image ? (
            <img
              src={image.url}
              alt={`Imagem do certificado de ${trainingName}`}
              className="mx-auto block h-auto max-h-[260px] w-full object-contain sm:max-h-[320px]"
            />
          ) : (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparando a imagem do certificado…
            </div>
          )}
        </figure>
      )}

      <div className="border-t border-border pt-4">
        <h4 id={`linkedin-steps-${key}`} className="mb-2.5 text-sm font-bold text-foreground">
          Como compartilhar seu certificado:
        </h4>
        <ol aria-labelledby={`linkedin-steps-${key}`} className="space-y-2 text-sm leading-relaxed text-foreground">
          {SHARE_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-2">
              <span className="w-4 shrink-0 text-right font-bold">{i + 1}.</span>
              <span className="min-w-0"><strong>{step.title}</strong> {step.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div role="note" className="rounded-lg bg-muted p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> Dica importante
        </p>
        <p className="mt-1 text-xs leading-relaxed text-foreground sm:text-[13px]">
          Não se esqueça de anexar a imagem do certificado antes de publicar. Assim, sua rede poderá visualizar sua conquista!
        </p>
      </div>

      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          Ver e editar o texto sugerido
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-1.5 border-t border-border p-3">
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
            rows={7}
            className="min-h-[150px] resize-y text-sm leading-relaxed"
          />
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={copy} className="h-8 gap-1.5 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar texto
            </Button>
          </div>
        </div>
      </details>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Button variant="outline" onClick={download} disabled={preparing} className="h-auto min-h-11 min-w-0 gap-2 whitespace-normal py-2 text-center">
            {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {downloaded ? "Imagem baixada" : "Baixar imagem do certificado"}
          </Button>
          <Button onClick={openLinkedIn} className="h-auto min-h-11 min-w-0 gap-2 whitespace-normal bg-linkedin py-2 text-center font-semibold text-linkedin-foreground hover:bg-linkedin/90">
            <Linkedin className="h-4 w-4" /> Compartilhar minha conquista no LinkedIn
          </Button>
        </div>
        {nativeShare && (
          <Button variant="ghost" onClick={shareNative} className="h-auto min-h-10 w-full gap-2 whitespace-normal text-linkedin hover:bg-linkedin/10 hover:text-linkedin">
            <Share2 className="h-4 w-4" /> Ou envie a imagem direto para o app do LinkedIn
          </Button>
        )}
        <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>Você revisa e confirma sua publicação. Nada é publicado automaticamente.</p>
          <a
            href={linkedInAddToProfileUrl({ name: trainingName, issuedAt: cert.issuedAt, code: cert.code })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 font-medium text-linkedin hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Adicionar ao perfil
          </a>
        </div>
      </div>
    </section>
  );
};

export default LinkedInAchievementShare;
