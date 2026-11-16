import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, BookOpenText, ExternalLink, MessageCircleQuestion, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  ASSISTANT_MODULES, GREETING, needsSupportHint, parseAnswer, type AssistantModule, type CandidateSource, type CitedPage,
} from "@/lib/nextiAssistant";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexti-ai-chat`;
export const SUPPORT_HINT = `Não consegui compreender sua dúvida por completo, mas não se preocupe! Nosso time está à disposição para ajudar você a encontrar a melhor solução. Entre em contato por um dos nossos canais oficiais de atendimento:

📧 E-mail: suporte@nexti.com
📱 WhatsApp: (48) 3112-1123
💬 Chat: diretamente pelo sistema.

Conte com a gente! 🧡`;

function friendlyError(error: Error | undefined) {
  if (!error) return null;
  const raw = error.message || "";
  try {
    const j = JSON.parse(raw);
    if (typeof j?.error === "string") return j.error;
  } catch { /* not JSON */ }
  if (/failed to fetch|network/i.test(raw)) return "Sem conexão com o assistente. Verifique sua internet e tente de novo.";
  return raw && raw.length < 200 ? raw : "O assistente está indisponível no momento. Tente novamente em instantes.";
}

/** Discreet launcher + panel. History lives only in memory for the signed-in user (no storage). */
export default function NextiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          variant="outline"
          className="fixed bottom-4 right-4 z-40 rounded-full border-primary/40 bg-card text-primary shadow-md hover:bg-primary/5 hover:text-primary"
        >
          <MessageCircleQuestion className="h-4 w-4" /> Tirar dúvida com IA
        </Button>
      )}
      <AssistantPanel key={user.id} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [module, setModule] = useState<AssistantModule | null>(null);
  const moduleRef = useRef<AssistantModule | null>(null);
  moduleRef.current = module;
  const formRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: ENDPOINT,
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${data.session?.access_token ?? ""}`,
          };
        },
        body: () => ({ module: moduleRef.current }),
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const moduleLabel = ASSISTANT_MODULES.find((m) => m.id === module)?.label;

  const focusInput = () => setTimeout(() => formRef.current?.querySelector("textarea")?.focus(), 0);
  useEffect(() => {
    if (open && module && !busy) focusInput();
  }, [open, module, busy]);

  const newConversation = () => {
    stop();
    setMessages([]);
    clearError();
    setModule(null);
  };

  const parsed = messages.map((m, i) => {
    if (m.role !== "assistant") return null;
    const text = m.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
    const sources = (m.parts.find((p) => p.type === "data-sources") as { data?: CandidateSource[] } | undefined)?.data ?? [];
    return parseAnswer(text, sources, busy && i === messages.length - 1);
  });
  const assistantIdx = messages.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  const notFoundFlags = assistantIdx.map((i) => !!parsed[i]?.notFound);

  return (
    <section
      aria-label="Assistente dos manuais"
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
        "inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(660px,calc(100dvh-2rem))] sm:w-[410px] sm:rounded-2xl",
        !open && "hidden",
      )}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpenText className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight">Assistente dos manuais</h2>
          <p className="truncate text-xs text-muted-foreground">
            {moduleLabel ? `Módulo: ${moduleLabel}` : "Escolha o módulo para começar"}
          </p>
        </div>
        {(messages.length > 0 || module) && (
          <Button variant="ghost" size="xs" onClick={newConversation} className="text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Nova conversa
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-4 p-4">
          <div className="max-w-[88%] rounded-2xl border bg-muted/50 px-4 py-3 text-sm leading-relaxed">
            Olá! Eu respondo com base nos manuais e indico onde ler mais.
            <br />
            <strong>Sobre qual módulo é a sua dúvida?</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            {ASSISTANT_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => setModule(m.id)}
                className={cn(
                  "rounded-full border border-primary px-4 py-2 text-sm font-semibold transition-colors",
                  module === m.id ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/5",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {module && (
            <div className="max-w-[88%] rounded-2xl border bg-muted/50 px-4 py-3 text-sm leading-relaxed">{GREETING}</div>
          )}

          {messages.map((m, i) => {
            if (m.role === "user") {
              const text = m.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
              return (
                <Message key={m.id} from="user">
                  <MessageContent className="bg-primary text-primary-foreground">{text}</MessageContent>
                </Message>
              );
            }
            const a = parsed[i]!;
            const isLast = i === messages.length - 1;
            const pos = assistantIdx.indexOf(i);
            if (!a.body && isLast && busy) return null;
            return (
              <Message key={m.id} from="assistant">
                <MessageContent className="w-full text-sm">
                  <MessageResponse isAnimating={isLast && status === "streaming"}>{a.body}</MessageResponse>
                  {a.pages.length > 0 && !(isLast && busy) && <SourcesBlock pages={a.pages} />}
                  {needsSupportHint(notFoundFlags, pos) && !(isLast && busy) && (
                    <div className="mt-3 whitespace-pre-line rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                      {SUPPORT_HINT}
                    </div>
                  )}
                  {!(isLast && busy) && a.body && <Feedback message={m} pages={a.pages} />}
                </MessageContent>
              </Message>
            );
          })}

          {busy && (status === "submitted" || !parsed[messages.length - 1]?.body) && (
            <Shimmer className="text-sm">Consultando os materiais…</Shimmer>
          )}
          {error && !busy && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {friendlyError(error)}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div ref={formRef} className="border-t px-3 pb-2 pt-3">
        <PromptInput
          onSubmit={({ text }) => {
            const t = text.trim();
            if (!t || !module || busy) return;
            clearError();
            sendMessage({ text: t });
            focusInput();
          }}
          className="rounded-xl"
        >
          <PromptInputTextarea
            disabled={!module}
            maxLength={2000}
            placeholder={module ? "Escreva sua dúvida…" : "Escolha o módulo acima"}
            className="min-h-11 text-sm"
          />
          <PromptInputFooter className="justify-end pt-0">
            <PromptInputSubmit status={status} onStop={stop} disabled={!module} aria-label="Enviar dúvida">
              {busy ? undefined : <ArrowUp className="h-4 w-4" />}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 px-2 text-center text-[11px] leading-snug text-muted-foreground">
          Respostas geradas por IA a partir dos manuais: confira no manual indicado. Não inclua dados pessoais na pergunta.
        </p>
      </div>
    </section>
  );
}

function SourcesBlock({ pages }: { pages: CitedPage[] }) {
  return (
    <div className="mt-3 rounded-xl border bg-muted/30 px-3 py-2">
      <p className="text-xs font-semibold">Fonte consultada</p>
      <ul className="mt-1 space-y-1.5">
        {pages.map((p) => (
          <li key={p.page_id} className="text-xs">
            <span className="font-medium">{p.title}</span>
            <span className="ml-1 inline-flex flex-wrap gap-x-3">
              {p.orientation_path && (
                <Link to={`/nexti-na-pratica/${p.orientation_path}`} className="text-primary underline-offset-2 hover:underline">
                  Ver no Nexti na Prática
                </Link>
              )}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline">
                  Notion <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feedback({ message, pages }: { message: UIMessage; pages: CitedPage[] }) {
  const [vote, setVote] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const send = async (helpful: boolean) => {
    setVote(helpful);
    setFailed(false);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("ai_assistant_feedback").insert({
      helpful, user_id: data.user!.id, source_page_ids: pages.map((p) => p.page_id).slice(0, 10),
    });
    if (error) { setVote(null); setFailed(true); }
  };
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" data-message={message.id}>
      {vote === null ? (
        <>
          <span>Esta resposta ajudou?</span>
          <Button variant="outline" size="xs" onClick={() => send(true)}><ThumbsUp className="h-3 w-3" /> Sim</Button>
          <Button variant="outline" size="xs" onClick={() => send(false)}><ThumbsDown className="h-3 w-3" /> Não</Button>
          {failed && <span className="text-destructive">Não foi possível registrar.</span>}
        </>
      ) : (
        <span>Obrigado pela avaliação!</span>
      )}
    </div>
  );
}
