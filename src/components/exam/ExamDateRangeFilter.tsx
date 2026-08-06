import { CalendarRange, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ExamDateRange } from "@/lib/examExport";

interface Props {
  value: ExamDateRange;
  onChange: (range: ExamDateRange) => void;
  className?: string;
}

/** Filtro de intervalo de datas usado no histórico/exportação de avaliações. */
const ExamDateRangeFilter = ({ value, onChange, className = "" }: Props) => {
  const active = Boolean(value.from || value.to);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" /> Período
      </span>
      <Input
        type="date"
        aria-label="Data inicial"
        value={value.from || ""}
        max={value.to || undefined}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        className="h-9 w-[9.5rem]"
      />
      <span className="text-xs text-muted-foreground">até</span>
      <Input
        type="date"
        aria-label="Data final"
        value={value.to || ""}
        min={value.from || undefined}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        className="h-9 w-[9.5rem]"
      />
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="h-9 px-2 text-muted-foreground">
          <X className="mr-1 h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
};

export default ExamDateRangeFilter;
