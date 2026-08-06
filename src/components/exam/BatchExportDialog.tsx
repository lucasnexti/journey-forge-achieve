import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, FileText, Layers, Loader2 } from "lucide-react";
import ExamDateRangeFilter from "@/components/exam/ExamDateRangeFilter";
import {
  exportAttemptsCsv, exportAttemptsPdf, filterAttemptsByDate,
  type ExamAttemptExportRow, type ExamDateRange,
} from "@/lib/examExport";

interface TrackOption { id: string; title: string }

interface Props {
  tracks: TrackOption[];
  /** curso pré-selecionado ao abrir o diálogo */
  defaultTrackId?: string;
}

/** Exportação em lote: vários cursos em um único CSV/PDF. */
const BatchExportDialog = ({ tracks, defaultTrackId }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultTrackId ? [defaultTrackId] : []);
  const [dateRange, setDateRange] = useState<ExamDateRange>({});
  const [busy, setBusy] = useState(false);

  const allSelected = tracks.length > 0 && selected.length === tracks.length;
  const title = useMemo(() => {
    if (selected.length === tracks.length && tracks.length > 0) return "Todos os cursos";
    if (selected.length === 1) return tracks.find((t) => t.id === selected[0])?.title || "Curso";
    return `${selected.length} cursos selecionados`;
  }, [selected, tracks]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fetchRows = async (): Promise<ExamAttemptExportRow[]> => {
    const { data: exams } = await supabase
      .from("exams")
      .select("id, track_id, passing_score")
      .in("track_id", selected);
    if (!exams?.length) return [];

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("user_id, track_id, exam_id, percent, correct_count, total_questions, passed, duration_seconds, attempt_number, created_at, passing_score")
      .in("exam_id", exams.map((e) => e.id))
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!attempts?.length) return [];

    const userIds = [...new Set(attempts.map((a) => a.user_id))];
    const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", userIds);
    const names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.nome]));
    const trackTitles = Object.fromEntries(tracks.map((t) => [t.id, t.title]));

    const rows: ExamAttemptExportRow[] = attempts.map((a) => ({
      track_title: trackTitles[a.track_id] || "Curso",
      nome: names[a.user_id] || "Aluno",
      attempt_number: a.attempt_number,
      correct_count: a.correct_count,
      total_questions: a.total_questions,
      percent: Number(a.percent),
      passing_score: a.passing_score,
      duration_seconds: a.duration_seconds,
      passed: a.passed,
      created_at: a.created_at,
    }));

    return rows.sort(
      (x, y) =>
        (x.track_title || "").localeCompare(y.track_title || "") ||
        new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
    );
  };

  const run = async (format: "csv" | "pdf") => {
    if (!selected.length) return toast.error("Selecione ao menos um curso.");
    setBusy(true);
    try {
      const rows = await fetchRows();
      const filtered = filterAttemptsByDate(rows, dateRange);
      if (!filtered.length) {
        toast.error("Nenhuma tentativa encontrada para os filtros selecionados.");
        return;
      }
      if (format === "csv") {
        exportAttemptsCsv(filtered, title, dateRange);
        toast.success(`CSV gerado com ${filtered.length} registro(s).`);
      } else {
        const ok = exportAttemptsPdf(filtered, title, dateRange);
        if (!ok) toast.error("Permita pop-ups para gerar o PDF.");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers className="mr-2 h-4 w-4" /> Exportação em lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportação em lote</DialogTitle>
          <DialogDescription>
            Selecione os cursos e baixe um único arquivo com todos os resultados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Cursos ({selected.length}/{tracks.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(allSelected ? [] : tracks.map((t) => t.id))}
            >
              {allSelected ? "Limpar seleção" : "Selecionar todos"}
            </Button>
          </div>

          <ScrollArea className="h-56 rounded-lg border border-border/60 p-2">
            <div className="space-y-1">
              {tracks.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary/60"
                >
                  <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
                  <span className="text-foreground">{t.title}</span>
                </label>
              ))}
            </div>
          </ScrollArea>

          <ExamDateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => run("csv")} disabled={busy || !selected.length}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            CSV
          </Button>
          <Button
            onClick={() => run("pdf")}
            disabled={busy || !selected.length}
            className="bg-gradient-nexti text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchExportDialog;
