import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROVIDER_LABEL, type OpenedManual } from "@/lib/nextiAssistant";

/** Address of the file itself, for "Abrir em nova aba" (Drive's preview page becomes its normal view page). */
const newTabUrl = (m: OpenedManual) => m.viewer_url.replace(/\/preview$/, "/view");

/** Shows a material cited by the assistant inside Nexti na Prática, keeping the chat open beside it. */
export default function ManualViewer({ manual, onBack }: { manual: OpenedManual; onBack: () => void }) {
  const isVideo = manual.viewer_url.endsWith(".mp4");
  return (
    <section aria-label={`Manual: ${manual.title}`} className="absolute inset-0 z-10 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Nexti na Prática
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="truncate text-base font-semibold">{manual.title}</h1>
          {manual.provider && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">· {PROVIDER_LABEL[manual.provider] ?? manual.provider}</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <a href={newTabUrl(manual)} target="_blank" rel="noreferrer">
            Abrir em nova aba <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </header>
      <div className="min-h-0 flex-1 bg-muted/40">
        {isVideo ? (
          <video key={manual.viewer_url} src={manual.viewer_url} controls className="h-full w-full bg-foreground/90" />
        ) : (
          <iframe key={manual.viewer_url} src={manual.viewer_url} title={manual.title} className="block h-full w-full border-0" allow="fullscreen" />
        )}
      </div>
    </section>
  );
}
