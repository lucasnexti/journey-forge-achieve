import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
export default function SurveyDatePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const date = value ? new Date(`${value}T12:00:00`) : undefined;
  return <Popover><PopoverTrigger asChild><Button variant="outline" disabled={disabled} className="w-full justify-start font-normal" aria-label="Data de realização"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date,"dd/MM/yyyy") : "Selecionar data"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar className="pointer-events-auto p-3" mode="single" locale={ptBR} selected={date} onSelect={d=>onChange(d ? format(d,"yyyy-MM-dd") : "")} initialFocus /><Button variant="ghost" onClick={()=>onChange("")}>Limpar data</Button></PopoverContent></Popover>;
}