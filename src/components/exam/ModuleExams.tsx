import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Lock, CheckCircle2, PlayCircle, FileText, Link2, Circle } from "lucide-react";
import { toast } from "sonner";
import { getMaterialLink } from "@/lib/courseMaterials";
import ExamRunner from "./ExamRunner";

interface Props {
  trackId: string;
  lessons: { id: string; title?: string; module_id?: string | null }[];
  isComplete: (lessonId: string) => boolean;
  currentLessonId?: string;
  onSelectLesson?: (id: string) => void;
}

interface Mod { id: string; title: string; order_index: number }
interface Mat { id: string; module_id: string; title: string; kind: string; file_path: string | null; external_url: string | null; file_name: string | null }
interface Ex { module_id: string; title: string; passing_score: number | null }
interface Att { module_id: string | null; percent: number; passed: boolean }

/** Conteúdo do curso por módulo: aulas → materiais → prova do módulo (ao final). */
export default function ModuleExams({ trackId, lessons, isComplete, currentLessonId, onSelectLesson }: Props) {
  const { user } = useAuth();
  const [mods, setMods] = useState<Mod[]>([]);
  const [mats, setMats] = useState<Mat[]>([]);
  const [exams, setExams] = useState<Ex[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [open, setOpen] = useState<Mod | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: m } = await supabase.from("course_modules").select("id, title, order_index").eq("track_id", trackId).order("order_index");
    const ids = (m || []).map((x) => x.id);
    const [{ data: e }, { data: a }, { data: mt }] = await Promise.all([
      supabase.from("exams").select("module_id, title, passing_score").eq("track_id", trackId).eq("is_active", true).not("module_id", "is", null),
      supabase.from("exam_attempts").select("module_id, percent, passed").eq("user_id", user.id).eq("track_id", trackId).not("module_id", "is", null),
      ids.length ? supabase.from("module_materials").select("id, module_id, title, kind, file_path, external_url, file_name").in("module_id", ids).order("order_index") : Promise.resolve({ data: [] as Mat[] }),
    ]);
    setMods(m || []); setExams((e || []) as Ex[]); setAtts((a || []) as Att[]); setMats((mt || []) as Mat[]);
  }, [trackId, user]);

  useEffect(() => { load(); }, [load]);
  if (!mods.length) return null;

  const openMat = async (x: Mat) => {
    try {
      const url = x.file_path ? await getMaterialLink(x.file_path) : x.external_url;
      if (url) window.open(url, "_blank", "noopener");
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="mt-5 space-y-4">
      <h3 className="font-display text-base font-bold text-foreground">Conteúdo do curso</h3>
      {mods.map((m) => {
        const modLessons = lessons.filter((l) => l.module_id === m.id);
        const modMats = mats.filter((x) => x.module_id === m.id);
        const exam = exams.find((x) => x.module_id === m.id);
        if (!modLessons.length && !modMats.length && !exam) return null;
        const mine = atts.filter((a) => a.module_id === m.id);
        const passed = mine.some((a) => a.passed);
        const best = mine.length ? Math.max(...mine.map((a) => Number(a.percent))) : null;
        const done = modLessons.filter((l) => isComplete(l.id)).length;
        const total = modLessons.length + (exam ? 1 : 0);
        const doneAll = done + (passed ? 1 : 0);
        const unlocked = modLessons.length > 0 && done === modLessons.length;
        return (
          <section key={m.id} className="card-surface p-4 sm:p-5">
            <h4 className="text-sm sm:text-base font-semibold text-foreground">{m.title}</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Atividades completas: <span className="font-semibold text-primary">{doneAll}/{total}</span>
            </p>
            <Progress value={total ? (doneAll / total) * 100 : 0} className="mt-2 h-1.5" />
            <ul className="mt-3 space-y-1.5">
              {modLessons.map((l, i) => {
                const ok = isComplete(l.id);
                const active = l.id === currentLessonId;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => { onSelectLesson?.(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? "bg-primary/10 text-foreground" : "bg-muted/40 hover:bg-muted"}`}
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
                    <p className="truncate font-medium text-foreground">{exam.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Nota mínima: {exam.passing_score ?? 70}%{best !== null ? ` · melhor nota ${best}%` : ""}
                    </p>
                  </div>
                  {passed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Aprovado</span>
                  ) : (
                    <Button size="sm" disabled={!unlocked} onClick={() => setOpen(m)} className="gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90">
                      {unlocked ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {unlocked ? "Iniciar avaliação" : "Conclua as aulas"}
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
          {open && <ExamRunner key={open.id} trackId={trackId} moduleId={open.id} locked={false} onFinished={() => load()} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
