import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, SkipBack, SkipForward, ArrowRight } from "lucide-react";

export const isJmvStreamUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)jmvstream\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
};

interface Props {
  videoUrl: string;
  lessonTitle: string;
  lessonDuration?: number;
  initialWatchedSeconds?: number;
  onComplete: (watchedSeconds: number) => void;
  onProgress?: (watchedSeconds: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Player oficial da JMVStream incorporado via iframe (página de player, não arquivo de vídeo).
 * O player não envia eventos de progresso para a página, então o tempo assistido é estimado
 * pelo tempo em que a aula fica aberta e visível; a conclusão é liberada ao atingir 90% da duração.
 */
const JmvStreamPlayer = ({ videoUrl, lessonTitle, lessonDuration = 0, initialWatchedSeconds = 0, onComplete, onProgress, onNext, onPrev }: Props) => {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [watched, setWatched] = useState(initialWatchedSeconds);
  const [completed, setCompleted] = useState(false);
  const watchedRef = useRef(initialWatchedSeconds);
  const lastSaved = useRef(initialWatchedSeconds);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    watchedRef.current = initialWatchedSeconds;
    lastSaved.current = initialWatchedSeconds;
    setWatched(initialWatchedSeconds);
    setCompleted(false);
    setStatus("loading");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => {
    if (status !== "loading") return;
    const t = window.setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), 20000);
    return () => window.clearTimeout(t);
  }, [status, reloadKey]);

  // Tempo assistido estimado (só conta com a aba visível e o player carregado)
  useEffect(() => {
    if (status !== "ready") return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const cap = lessonDuration > 0 ? lessonDuration : Infinity;
      watchedRef.current = Math.min(watchedRef.current + 1, cap);
      setWatched(watchedRef.current);
      if (watchedRef.current - lastSaved.current >= 30) {
        lastSaved.current = watchedRef.current;
        onProgressRef.current?.(Math.round(watchedRef.current));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, lessonDuration]);

  useEffect(() => () => {
    if (watchedRef.current > lastSaved.current) onProgressRef.current?.(Math.round(watchedRef.current));
  }, [videoUrl]);

  const canComplete = lessonDuration <= 0 || watched >= lessonDuration * 0.9;
  const percent = lessonDuration > 0 ? Math.min(100, Math.round((watched / lessonDuration) * 100)) : completed ? 100 : 0;

  const markDone = () => {
    if (completed || !canComplete) return;
    setCompleted(true);
    const secs = Math.round(lessonDuration > 0 ? Math.max(watched, lessonDuration) : watched || 60);
    onProgressRef.current?.(secs);
    onComplete(secs);
  };

  return (
    <div className="overflow-hidden rounded-lg sm:rounded-xl bg-foreground/5">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          key={reloadKey}
          src={videoUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={lessonTitle}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Não foi possível carregar o vídeo</p>
            <p className="text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
            <button
              onClick={() => { setStatus("loading"); setReloadKey((k) => k + 1); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}
      </div>

      <div className="relative h-2 sm:h-1.5 bg-border">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-1 px-2 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-0.5">
          {onPrev && (
            <button onClick={onPrev} aria-label="Aula anterior" className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
              <SkipBack className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} aria-label="Próxima aula" className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
              <SkipForward className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>
        <span className="ml-1 tabular-nums text-xs text-muted-foreground">
          {fmt(watched)}{lessonDuration > 0 ? ` / ${fmt(lessonDuration)}` : ""}
        </span>
        <div className="flex-1" />
        {!completed && (
          <button
            onClick={markDone}
            disabled={!canComplete}
            title={canComplete ? undefined : "Assista ao vídeo até o final para concluir"}
            className="rounded-lg border border-border bg-secondary px-3 py-2 sm:py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canComplete ? "Marcar como assistida" : "Assista até o final para concluir"}
          </button>
        )}
      </div>

      {completed && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 border-t border-border/50 bg-green-50 dark:bg-green-900/10 px-4 py-2.5 sm:py-2 text-center text-xs font-medium text-green-700 dark:text-green-400">
          <span>✓ Aula concluída — "{lessonTitle}"</span>
          {onNext && (
            <button onClick={onNext} className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              Próxima etapa <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default JmvStreamPlayer;
