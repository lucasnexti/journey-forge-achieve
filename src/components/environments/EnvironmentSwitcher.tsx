import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useSelectedEnvironment } from "@/hooks/useSelectedEnvironment";

/** Seletor de ambiente do topo — aparece só para o Master. */
export function EnvironmentSwitcher() {
  const { isMaster } = useIsAdmin();
  const { data: envs = [] } = useEnvironments(isMaster);
  const [selected, setSelected] = useSelectedEnvironment();
  if (!isMaster) return null;
  return (
    <Select value={selected} onValueChange={setSelected}>
      <SelectTrigger aria-label="Ambiente" className="h-9 w-[190px]">
        <Building2 className="mr-2 h-4 w-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os ambientes</SelectItem>
        {envs.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.is_active ? "" : " (inativo)"}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
