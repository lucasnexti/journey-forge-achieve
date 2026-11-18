import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { audienceLabel, PERMISSIONS, type ResearchPermission } from "@/lib/research";
import type { Tables } from "@/integrations/supabase/types";

type Setting = Tables<"research_settings">;

export default function SettingsTab({ canManage, isAdmin }: { canManage: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["research-settings"], queryFn: async () => { const { data, error } = await supabase.from("research_settings").select("*").order("audience", { ascending: false }); if (error) throw error; return data; } });
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-semibold">Configuração pendente para disparos reais</p>
          <p>O serviço de e-mail ainda não está configurado para o domínio nexti.com. Até lá, convites, lembretes e avisos ficam na fila como "Aguardando configuração" — nada é enviado nem marcado como enviado.</p>
          <p className="text-muted-foreground">Depois de configurar o domínio, ligue "Envios reais liberados" no público desejado e use "Reprocessar" nos detalhes da pesquisa.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{(settings.data ?? []).map((s) => <AudienceSettings key={s.audience} s={s} disabled={!canManage} onSaved={() => qc.invalidateQueries({ queryKey: ["research-settings"] })} />)}</div>
      {isAdmin && <AccessManager />}
    </div>
  );
}

function AudienceSettings({ s, disabled, onSaved }: { s: Setting; disabled: boolean; onSaved: () => void }) {
  const [v, setV] = useState(s);
  const [saving, setSaving] = useState(false);
  useEffect(() => setV(s), [s]);
  const save = async () => {
    if (v.sending_enabled && !s.sending_enabled && !window.confirm(`Liberar envios reais para ${audienceLabel(s.audience)}? Convites na fila poderão ser disparados.`)) return;
    setSaving(true);
    const { error } = await supabase.from("research_settings").update({ sender_email: v.sender_email.trim(), sender_name: v.sender_name.trim(), default_deadline_days: v.default_deadline_days, default_reminder_days: v.default_reminder_days, sending_enabled: v.sending_enabled, updated_at: new Date().toISOString() }).eq("audience", s.audience);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Configurações salvas."); onSaved(); }
  };
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold">{audienceLabel(s.audience)}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`se-${s.audience}`}>E-mail do remetente</Label><Input id={`se-${s.audience}`} type="email" disabled={disabled} value={v.sender_email} onChange={(e) => setV({ ...v, sender_email: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor={`sn-${s.audience}`}>Nome do remetente</Label><Input id={`sn-${s.audience}`} disabled={disabled} value={v.sender_name} onChange={(e) => setV({ ...v, sender_name: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor={`sd-${s.audience}`}>Prazo padrão (dias)</Label><Input id={`sd-${s.audience}`} type="number" min={1} max={90} disabled={disabled} value={v.default_deadline_days} onChange={(e) => setV({ ...v, default_deadline_days: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label htmlFor={`sr-${s.audience}`}>Lembrete padrão após (dias)</Label><Input id={`sr-${s.audience}`} type="number" min={1} max={60} disabled={disabled} value={v.default_reminder_days} onChange={(e) => setV({ ...v, default_reminder_days: Number(e.target.value) })} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={v.sending_enabled} disabled={disabled} onCheckedChange={(c) => setV({ ...v, sending_enabled: c })} />Envios reais liberados</label>
      {!disabled && <Button size="sm" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>}
    </section>
  );
}

function AccessManager() {
  const [search, setSearch] = useState("");
  const perms = useQuery({
    queryKey: ["research-access"],
    queryFn: async () => {
      const { data, error } = await supabase.from("research_permissions").select("user_id,permission");
      if (error) throw error;
      const ids = [...new Set(data.map((d) => d.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id,nome,email").in("user_id", ids) : { data: [] };
      return ids.map((id) => ({ user_id: id, nome: profs?.find((p) => p.user_id === id)?.nome ?? "—", email: profs?.find((p) => p.user_id === id)?.email ?? "", perms: data.filter((d) => d.user_id === id).map((d) => d.permission as ResearchPermission) }));
    },
  });
  const found = useQuery({
    queryKey: ["research-access-search", search], enabled: search.trim().length >= 3,
    queryFn: async () => { const t = search.trim().replace(/[%,()]/g, ""); const { data, error } = await supabase.from("profiles").select("user_id,nome,email").or(`nome.ilike.%${t}%,email.ilike.%${t}%`).limit(8); if (error) throw error; return data; },
  });
  const set = async (userId: string, list: ResearchPermission[]) => {
    const { error } = await supabase.rpc("research_set_user_permissions", { _user_id: userId, _permissions: list });
    if (error) toast.error(error.message); else { toast.success("Acessos atualizados."); perms.refetch(); }
  };
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold">Quem acessa Pesquisas e Indicadores</h3>
      <p className="text-sm text-muted-foreground">Administradores têm acesso completo. Conceda permissões específicas a outras pessoas.</p>
      <div className="relative max-w-md">
        <Input placeholder="Buscar pessoa por nome ou e-mail (mín. 3 letras)" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar pessoa" />
        {(found.data?.length ?? 0) > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md">{found.data!.map((p) => (
            <li key={p.user_id}><button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { set(p.user_id, ["indicators_view"]); setSearch(""); }}><UserPlus className="h-4 w-4 text-primary" />{p.nome} <span className="text-xs text-muted-foreground">{p.email}</span></button></li>
          ))}</ul>
        )}
      </div>
      {perms.isLoading ? <p role="status">Carregando…</p> : !perms.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma permissão concedida além dos administradores.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Pessoa</th>{PERMISSIONS.map((p) => <th key={p.value} className="p-2 text-center">{p.label}</th>)}</tr></thead>
          <tbody>{perms.data.map((u) => (
            <tr key={u.user_id} className="border-t border-border"><td className="p-2"><p className="font-medium">{u.nome}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
              {PERMISSIONS.map((p) => <td key={p.value} className="p-2 text-center"><Checkbox aria-label={`${p.label} para ${u.nome}`} checked={u.perms.includes(p.value)} onCheckedChange={(c) => set(u.user_id, c ? [...u.perms, p.value] : u.perms.filter((x) => x !== p.value))} /></td>)}</tr>
          ))}</tbody></table></div>
      )}
    </section>
  );
}
