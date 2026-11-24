import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Lock, CheckCircle2 } from "lucide-react";
import ExamRunner from "./ExamRunner";

interface Props {
  trackId: string;
  lessons: { id: string; module_id?: string | null }[];
  isComplete: (lessonId: string) => boolean;
}

interface Row { moduleId: string; moduleTitle: string; order: number; examTitle: string; passed: boolean; best: number | null }

/** Provas por módulo: liberadas quando o aluno conclui as aulas do módulo. */
export default function ModuleExams({ trackId, lessons, isComplete }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: exams }, { data: mods }, { data: atts }] = await Promise.all([
      supabase.from("exams").select("id, title, module_id").eq("track_id", trackId).eq("is_active", true).not("module_id", "is", null),
      supabase.from("course_modules").select("id, title, order_index").eq("track_id", trackId),
      supabase.from("exam_attempts").select("module_id, percent, passed").eq("user_id", user.id).eq("track_id", trackId).not("module_id", "is", null),
    ]);
    const list: Row[] = (exams || []).flatMap((e) => {
      const m = (mods || []).find((x) => x.id === e.module_id);
      if (!m) return [];
      const mine = (atts || []).filter((a) => a.module_id === m.id);
      return [{
        moduleId: m.id, moduleTitle: m.title, order: m.order_index, examTitle: e.title,
        passed: mine.some((a) => a.passed),
        best: mine.length ? Math.max(...mine.map((a) => Number(a.percent))) : null,
      }];
    }).sort((a, b) => a.order - b.order);
    setRows(list);
  }, [trackId, user]);

  useEffect(() => { load(); }, [load]);
  if (!rows.length) return null;

  return (
    <div className="card-surface p-4 sm:p-5 mt-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" /> Provas dos módulos
      </h3>
      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const modLessons = lessons.filter((l) => l.module_id === r.moduleId);
          const done = modLessons.filter((l) => isComplete(l.id)).length;
          const unlocked = modLessons.length > 0 && done === modLessons.length;
          return (
            <div key={r.moduleId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.moduleTitle}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.examTitle} · {done}/{modLessons.length} aulas{r.best !== null ? ` · melhor nota ${r.best}%` : ""}
                </p>
              </div>
              {r.passed ? (
                <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Aprovado</Badge>
              ) : (
                <Button size="sm" disabled={!unlocked} onClick={() => setOpen(r)} className="gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90">
                  {unlocked ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {unlocked ? "Iniciar avaliação" : "Conclua as aulas"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); load(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prova do módulo — {open?.moduleTitle}</DialogTitle></DialogHeader>
          {open && (
            <ExamRunner key={open.moduleId} trackId={trackId} moduleId={open.moduleId} locked={false} onFinished={() => load()} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
