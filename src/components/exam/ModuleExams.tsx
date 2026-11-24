import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { contentForModule, lockedModuleIds } from "@/lib/moduleContent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Lock, CheckCircle2, PlayCircle, FileText, Link2, Circle } from "lucide-react";
import { toast } from "sonner";
import { getMaterialLink } from "@/lib/courseMaterials";
import ExamRunner, { type ExamResult } from "./ExamRunner";

interface Props {
  trackId: string;
  lessons: { id: string; title?: string; module_id?: string | null }[];
  isComplete: (lessonId: string) => boolean;
  currentLessonId?: string;
  onSelectLesson?: (id: string) => void;
  compact?: boolean;
  activeModuleId?: string | null;
}

interface Mod { id: string; title: string; order_index: number }
interface Mat { id: string; module_id: string; title: string; kind: string; file_path: string | null; external_url: string | null; file_name: string | null }
interface Ex { module_id: string; title: string; passing_score: number | null }
interface Att { module_id: string | null; percent: number; passed: boolean }

/** Conteúdo do curso por módulo: aulas → materiais → prova do módulo (ao final). */
export const OPEN_MODULE_EXAM_EVENT = "nexti:open-module-exam";

export function useCourseModuleContent(trackId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["course-module-content", trackId, user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
    if (!user || !trackId) return { mods: [], exams: [], atts: [], mats: [] };
    const { data: m } = await supabase.from("course_modules").select("id, title, order_index").eq("track_id", trackId!).order("order_index");
    const ids = (m || []).map((x) => x.id);
    const [{ data: e }, { data: a }, { data: mt }] = await Promise.all([
      supabase.from("exams").select("module_id, title, passing_score").eq("track_id", trackId).eq("is_active", true).not("module_id", "is", null),
      supabase.from("exam_attempts").select("module_id, percent, passed").eq("user_id", user.id).eq("track_id", trackId).not("module_id", "is", null),
      ids.length ? supabase.from("module_materials").select("id, module_id, title, kind, file_path, external_url, file_name").in("module_id", ids).order("order_index") : Promise.resolve({ data: [] as Mat[] }),
    ]);
    return { mods: (m || []) as Mod[], exams: (e || []) as Ex[], atts: (a || []) as Att[], mats: (mt || []) as Mat[] };
    },
  });
}

/** Módulos bloqueados pela sequência (prova do módulo anterior pendente). */
export function useLockedModules(trackId: string | undefined, lessons: Props["lessons"], isComplete: (id: string) => boolean) {
  const { data } = useCourseModuleContent(trackId);
  const { mods = [], exams = [], atts = [] } = data || {};
  return lockedModuleIds(mods, lessons, exams.map((e) => e.module_id), atts.filter((a) => a.passed).map((a) => a.module_id as string), isComplete);
}

export default function ModuleExams({ trackId, lessons, isComplete, currentLessonId, onSelectLesson, compact = false, activeModuleId }: Props) {
  const [open, setOpen] = useState<Mod | null>(null);
  const { data, refetch: load } = useCourseModuleContent(trackId);
  const { mods = [], exams = [], atts = [], mats = [] } = data || {};
  const locked = lockedModuleIds(mods, lessons, exams.map((e) => e.module_id), atts.filter((a) => a.passed).map((a) => a.module_id as string), isComplete);

  // Botão "Próxima etapa" pede para abrir a prova do módulo.
  useEffect(() => {
    if (compact) return;
    const h = (e: Event) => { const m = mods.find((x) => x.id === (e as CustomEvent).detail); if (m) setOpen(m); };
    window.addEventListener(OPEN_MODULE_EXAM_EVENT, h);
    return () => window.removeEventListener(OPEN_MODULE_EXAM_EVENT, h);
  }, [compact, mods]);

  // Ao terminar o último vídeo do módulo, abre automaticamente a prova daquele módulo.
  const prevReady = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (compact || !data) return;
    for (const m of mods) {
      const ls = contentForModule(lessons, m.id);
      const ready = ls.length > 0 && ls.every((l) => isComplete(l.id));
      const hasExam = exams.some((e) => e.module_id === m.id);
      const passed = atts.some((a) => a.module_id === m.id && a.passed);
      if (prevReady.current[m.id] === false && ready && hasExam && !passed && !locked.has(m.id)) {
        toast.success("Vídeos do módulo concluídos! Agora faça a prova do módulo.");
        setOpen(m);
      }
      prevReady.current[m.id] = ready;
    }
  });

  const finished = async (m: Mod, res: ExamResult) => {
    await load();
    if (!res.passed) return;
    const { data: r } = await supabase.rpc("claim_coin_reward", { _key: "module_complete", _reference_id: m.id });
    const amount = (r as { amount?: number } | null)?.amount || 0;
    if (amount > 0) toast.success(`Módulo concluído! +${amount} Nexti Coins`);
    const idx = mods.findIndex((x) => x.id === m.id);
    const next = mods.slice(idx + 1).find((x) => contentForModule(lessons, x.id).length > 0);
    const first = next && contentForModule(lessons, next.id)[0];
    if (first) {
      toast.success(`Próximo módulo liberado: ${next!.title}`);
      setTimeout(() => { setOpen(null); onSelectLesson?.(first.id); window.scrollTo({ top: 0, behavior: "smooth" }); }, 2500);
    }
  };
  if (!mods.length) return null;

  const openMat = async (x: Mat) => {
    try {
      const url = x.file_path ? await getMaterialLink(x.file_path) : x.external_url;
      if (url) window.open(url, "_blank", "noopener");
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className={compact ? "px-3 pb-3" : "mt-5 space-y-4"}>
      {!compact && <h3 className="font-display text-base font-bold text-foreground">Conteúdo do curso</h3>}
      {mods.filter((m) => !compact || m.id === activeModuleId).map((m) => {
        const modLessons = contentForModule(lessons, m.id);
        const modMats = contentForModule(mats, m.id);
        const exam = contentForModule(exams, m.id)[0];
        if (!modLessons.length && !modMats.length && !exam) return null;
        const mine = atts.filter((a) => a.module_id === m.id);
        const passed = mine.some((a) => a.passed);
        const best = mine.length ? Math.max(...mine.map((a) => Number(a.percent))) : null;
        const done = modLessons.filter((l) => isComplete(l.id)).length;
        const total = modLessons.length + (exam ? 1 : 0);
        const doneAll = done + (passed ? 1 : 0);
        const modLocked = locked.has(m.id);
        const unlocked = !modLocked && modLessons.length > 0 && done === modLessons.length;
        return (
          <section key={m.id} className={compact ? "space-y-2" : "card-surface p-4 sm:p-5"}>
            {!compact && <><h4 className="text-sm sm:text-base font-semibold text-foreground">{m.title}</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Atividades completas: <span className="font-semibold text-primary">{doneAll}/{total}</span>
            </p>
            <Progress value={total ? (doneAll / total) * 100 : 0} className="mt-2 h-1.5" /></>}
            {modLocked && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> Conclua o módulo anterior e seja aprovado na prova para liberar.</p>}
            <ul className="mt-3 space-y-1.5">
              {!compact && modLessons.map((l, i) => {
                const ok = isComplete(l.id);
                const active = l.id === currentLessonId;
                return (
                  <li key={l.id}>
                    <button
                      disabled={modLocked}
                      onClick={() => { onSelectLesson?.(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-primary/10 text-foreground" : "bg-muted/40 hover:bg-muted"}`}
                    >
                      <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 min-w-0 truncate">{l.title || `Vídeo ${i + 1}`}</span>
                      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                    </button>
                  </li>
                );
              })}
              {modMats.map((x) => (
                <li key={x.id}>
                  <button onClick={() => openMat(x)} className="flex w-full items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-left text-sm hover:bg-muted">
                    {x.file_path ? <FileText className="h-4 w-4 shrink-0 text-primary" /> : <Link2 className="h-4 w-4 shrink-0 text-primary" />}
                    <span className="flex-1 min-w-0 truncate">{x.title}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">Material</span>
                  </button>
                </li>
              ))}
              {exam && (
                <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                  <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="break-words font-medium text-foreground">{exam.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Nota mínima: {exam.passing_score ?? 70}%{best !== null ? ` · melhor nota ${best}%` : ""}
                    </p>
                  </div>
                  {passed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Aprovado</span>
                  ) : (
                    <Button size="sm" disabled={!unlocked} onClick={() => setOpen(m)} className={`gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90 ${compact ? "w-full" : ""}`}>
                      {unlocked ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {unlocked ? "Iniciar avaliação" : modLocked ? "Módulo bloqueado" : "Conclua as aulas"}
                    </Button>
                  )}
                </li>
              )}
            </ul>
          </section>
        );
      })}
      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); load(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prova do módulo — {open?.title}</DialogTitle></DialogHeader>
          {open && <ExamRunner key={open.id} trackId={trackId} moduleId={open.id} locked={false} onFinished={(res) => finished(open, res)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
