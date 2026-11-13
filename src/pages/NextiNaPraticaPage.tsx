import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { installNextiNaPraticaBridge } from "@/lib/nextiNaPraticaBridge";

// Must exist before the iframe script runs; the embedded site reads it from window.parent.
installNextiNaPraticaBridge();

const BASE = "/nexti-na-pratica";

/** Maps /nexti-na-pratica/<rota> to the original hash route #/<rota> of the embedded knowledge base. */
export function toHash(pathname: string, search: string) {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length).replace(/^\/+/, "") : "";
  return "#/" + rest + search;
}

export function toPath(hash: string) {
  const h = hash.replace(/^#\/?/, "");
  return h ? `${BASE}/${h}` : BASE;
}

export default function NextiNaPraticaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const initial = useRef(`${BASE}/index.html${toHash(location.pathname, location.search)}`);

  // Parent URL -> iframe (browser back/forward, direct links)
  useEffect(() => {
    const win = frame.current?.contentWindow;
    const want = toHash(location.pathname, location.search);
    if (win && win.location.hash !== want && decodeURI(win.location.hash) !== decodeURI(want)) win.location.hash = want;
  }, [location.pathname, location.search]);

  // iframe navigation -> parent URL (shareable addresses)
  const onLoad = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    const sync = () => {
      const path = toPath(win.location.hash);
      const [p, q = ""] = path.split("?");
      if (p !== window.location.pathname || (q ? "?" + q : "") !== window.location.search)
        navigate(path, { replace: true });
    };
    win.addEventListener("hashchange", sync);
    sync();
  };

  return (
    <AppLayout>
      <iframe
        ref={frame}
        src={initial.current}
        onLoad={onLoad}
        title="Nexti na Prática"
        className="block w-full h-[calc(100dvh-4rem)] md:h-[calc(100dvh-3rem)] border-0 bg-background"
      />
    </AppLayout>
  );
}
