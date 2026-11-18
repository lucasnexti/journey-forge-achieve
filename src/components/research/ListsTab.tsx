import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Upload, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImportListWizard from "./ImportListWizard";
import { formatDateBR, formatDateTimeBR, type Audience } from "@/lib/research";
import { downloadListTemplate } from "@/lib/spreadsheet";
import type { Tables } from "@/integrations/supabase/types";

export default function ListsTab({ audience, canImport }: { audience: Audience; canImport: boolean }) {
  const [importing, setImporting] = useState(false);
  const [viewing, setViewing] = useState<Tables<"research_lists"> | null>(null);
  const lists = useQuery({
    queryKey: ["research-lists", audience],
    queryFn: async () => { const { data, error } = await supabase.from("research_lists").select("*").eq("audience", audience).order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const members = useQuery({
    queryKey: ["research-list-members", viewing?.id], enabled: !!viewing,
    queryFn: async () => { const { data, error } = await supabase.from("research_list_members").select("*").eq("list_id", viewing!.id).order("name").limit(2000); if (error) throw error; return data; },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">As listas ficam registradas como presença, mesmo que a pessoa não responda. Reutilize uma lista em outra pesquisa sem duplicar a presença.</p>
        <div className="flex gap-2"><Button variant="outline" onClick={downloadListTemplate}><Download />Modelo de planilha</Button>{canImport && <Button onClick={() => setImporting(true)}><Upload />Importar lista</Button>}</div>
      </div>
      {lists.isLoading ? <p role="status">Carregando…</p> : lists.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as listas.</p> : !lists.data?.length ? (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center"><Users className="h-10 w-10 text-primary" /><p className="font-semibold">Nenhuma lista importada</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm"><thead className="bg-muted text-left text-xs"><tr><th className="p-3">Lista</th><th className="p-3">Finalidade</th><th className="p-3">Treinamento</th><th className="p-3">Empresa</th><th className="p-3">Pessoas</th><th className="p-3">Importada em</th><th className="p-3" /></tr></thead>
            <tbody>{lists.data.map((l) => {
              const s = l.summary as Record<string, number>;
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3"><p className="font-medium">{l.name}</p>{l.source_file_name && <p className="text-xs text-muted-foreground">{l.source_file_name}{l.source_sheet && ` · ${l.source_sheet}`}</p>}</td>
                  <td className="p-3"><Badge variant={l.purpose === "attendance" ? "default" : "secondary"}>{l.purpose === "attendance" ? "Presença" : "Destinatários"}</Badge></td>
                  <td className="p-3 text-xs">{l.training_name || "—"}{l.training_date && ` · ${formatDateBR(l.training_date)}`}{l.class_name && ` · Turma ${l.class_name}`}</td>
                  <td className="p-3 text-xs">{l.company_name || "—"}</td>
                  <td className="p-3 text-xs"><strong>{l.member_count}</strong>{l.purpose === "attendance" && s.attendance_existing ? <span className="text-muted-foreground"> · {s.attendance_existing} presenças já existiam</span> : null}</td>
                  <td className="p-3 text-xs">{formatDateTimeBR(l.created_at)}</td>
                  <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setViewing(l)}><Eye />Ver</Button></td>
                </tr>
              );
            })}</tbody></table>
        </div>
      )}
      <ImportListWizard audience={audience} open={importing} onClose={() => setImporting(false)} onImported={() => lists.refetch()} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle><DialogDescription>{viewing?.member_count} pessoas</DialogDescription></DialogHeader>
          {members.isLoading ? <p role="status">Carregando…</p> : (
            <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Empresa / Área</th><th className="p-2">Sessão</th></tr></thead>
              <tbody>{(members.data ?? []).map((m) => <tr key={m.id} className="border-t border-border"><td className="p-2">{m.name}</td><td className="p-2 text-xs">{m.email}</td><td className="p-2 text-xs">{m.company || "—"}{m.area && ` · ${m.area}`}</td><td className="p-2 text-xs">{m.training_name || "—"}{m.training_date && ` · ${formatDateBR(m.training_date)}`}</td></tr>)}</tbody></table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
