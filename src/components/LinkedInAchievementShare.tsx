import { useEffect, useRef, useState } from "react";
import { Linkedin, Copy, RotateCcw, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SHARE_INVITE, buildSuggestedPost, certificateVerifyUrl, linkedInAddToProfileUrl, linkedInComposerUrl,
} from "@/lib/linkedinShare";

type Lookup = { trackId: string; certificateId?: never } | { certificateId: string; trackId?: never };

interface Props {
  trainingName: string;
  lookup: Lookup;
  /** Sem moldura de cartão (para uso dentro de uma janela). */
  bare?: boolean;
}

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

/** Convite opcional para compartilhar a conquista; não interfere no acesso ao certificado. */
const LinkedInAchievementShare = ({ trainingName, lookup, bare = false }: Props) => {
  const [cert, setCert] = useState<{ code: string | null; issuedAt: string | null }>({ code: null, issuedAt: null });
  const [text, setText] = useState(() => buildSuggestedPost(trainingName));
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const editedRef = useRef(false);
  editedRef.current = edited;

  const key = lookup.trackId ?? lookup.certificateId;
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      let q = supabase.from("certificates").select("certificate_code, issued_at, revoked_at");
      q = lookup.certificateId ? q.eq("id", lookup.certificateId) : q.eq("track_id", lookup.trackId!).eq("user_id", auth.user?.id ?? "");
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      const code = data && !data.revoked_at ? data.certificate_code : null;
      if (code) {
        setCert({ code, issuedAt: data?.issued_at ?? null });
        if (!editedRef.current) setText(buildSuggestedPost(trainingName, certificateVerifyUrl(code)));
      } else if (!data?.revoked_at && tries++ < 5) {
        // o certificado pode estar sendo emitido neste instante
        timer = setTimeout(load, 3000);
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, trainingName]);

  const suggested = buildSuggestedPost(trainingName, certificateVerifyUrl(cert.code));

  const share = () => {
    const body = text.trim() || suggested;
    // abrir antes de copiar evita bloqueio de janela no navegador
    window.open(linkedInComposerUrl(body), "_blank", "noopener,noreferrer");
    copyText(body).then((ok) => {
      toast.success("Abrimos o LinkedIn para você revisar a publicação.", {
        description: ok
          ? "O texto também foi copiado. Se ele não aparecer na publicação, é só colar."
          : "Se o texto não aparecer na publicação, copie-o aqui na tela.",
      });
    });
  };

  const copy = async () => {
    const ok = await copyText(text.trim() || suggested);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Texto copiado."); }
    else toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
  };

  return (
    <section
      aria-label="Compartilhar conquista no LinkedIn"
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
          rows={9}
          className="min-h-[180px] resize-y text-sm leading-relaxed"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={share} className="h-11 flex-1 gap-2 bg-linkedin text-linkedin-foreground hover:bg-linkedin/90">
          <Linkedin className="h-4 w-4" />
          Compartilhar minha conquista no LinkedIn
        </Button>
        <Button variant="outline" onClick={copy} className="h-11 gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copiar texto
        </Button>
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
