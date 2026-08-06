import { useEffect } from "react";

/**
 * Pré-carrega o próximo trecho de vídeo para reduzir engasgos ao trocar de aula.
 * - Vimeo: preconnect nos hosts + prefetch do documento do player (aquece DNS/TLS/CDN).
 * - Arquivos diretos (mp4/webm): baixa os primeiros bytes para o cache HTTP.
 */
const isVimeoUrl = (url: string) =>
  url.includes("vimeo.com") || url.includes("player.vimeo.com");

const getVimeoEmbedUrl = (url: string) => {
  if (url.includes("player.vimeo.com/video/")) return url;
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (match) {
    const [, videoId, hash] = match;
    return hash
      ? `https://player.vimeo.com/video/${videoId}?h=${hash}`
      : `https://player.vimeo.com/video/${videoId}`;
  }
  return url;
};

const VIMEO_HOSTS = [
  "https://player.vimeo.com",
  "https://i.vimeocdn.com",
  "https://f.vimeocdn.com",
  "https://vod-progressive.akamaized.net",
];

const addLink = (rel: string, href: string, crossOrigin = true) => {
  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"][href="${CSS.escape(href)}"]`
  );
  if (existing) return null;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
  return link;
};

export function useVideoPrefetch(nextVideoUrl?: string | null, enabled = true) {
  useEffect(() => {
    if (!enabled || !nextVideoUrl) return;

    const created: HTMLLinkElement[] = [];
    let cancelled = false;
    let controller: AbortController | null = null;

    // Aguarda a ociosidade para não competir com o vídeo em reprodução
    const schedule =
      (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));

    const handle = schedule(() => {
      if (cancelled) return;

      if (isVimeoUrl(nextVideoUrl)) {
        VIMEO_HOSTS.forEach((host) => {
          const l = addLink("preconnect", host);
          if (l) created.push(l);
        });
        const l = addLink("prefetch", getVimeoEmbedUrl(nextVideoUrl), false);
        if (l) created.push(l);
        return;
      }

      // Vídeo direto: aquece o cache com o início do arquivo
      controller = new AbortController();
      fetch(nextVideoUrl, {
        method: "GET",
        headers: { Range: "bytes=0-1048575" },
        signal: controller.signal,
        mode: "cors",
        credentials: "omit",
      })
        .then((res) => res.blob())
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      controller?.abort();
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback;
      if (cancelIdle) cancelIdle(handle as number);
      else window.clearTimeout(handle as number);
      created.forEach((l) => l.parentNode?.removeChild(l));
    };
  }, [nextVideoUrl, enabled]);
}

export default useVideoPrefetch;
