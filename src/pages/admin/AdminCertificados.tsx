import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, FileUp, Plus, RefreshCw, Save, Search, Trash2, Ban } from "lucide-react";
import { CERT_FIELD_KEYS, CERT_FONTS, CertField, defaultField, openCertificatePdf } from "@/lib/certificates";

type Template = {
  id: string; name: string; file_path: string; file_name: string | null; fields: CertField[];
  track_ids: string[]; is_default: boolean; is_active: boolean; version: number;
};

const MAX_MB = 20;

const AdminCertificados = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [t, tr, c, p] = await Promise.all([
      supabase.from("certificate_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("tracks").select("id, title").order("title"),
      supabase.from("certificates").select("*, tracks(title)").order("issued_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    setTemplates((t.data as any) || []);
    setTracks(tr.data || []);
    setCerts(c.data || []);
    setNames(Object.fromEntries((p.data || []).map((x) => [x.user_id, x.nome])));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    setDraft(t ? JSON.parse(JSON.stringify(t)) : null);
    setPreviewUrl(null);
  }, [selectedId, templates]);

  const uploadPdf = async (file: File, replaceId?: string) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Envie o modelo em PDF.");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`O arquivo deve ter no máximo ${MAX_MB} MB.`);
    setBusy(true);
    const path = `templates/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("certificates").upload(path, file, { contentType: "application/pdf" });
    if (error) { setBusy(false); return toast.error("Falha no upload: " + error.message); }
    if (replaceId) {
      const cur = templates.find((t) => t.id === replaceId)!;
      await supabase.from("certificate_templates").update({ file_path: path, file_name: file.name, version: cur.version + 1 }).eq("id", replaceId);
      toast.success("Nova versão do modelo enviada. Os campos configurados foram mantidos.");
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error: e2 } = await supabase.from("certificate_templates").insert({
        name: file.name.replace(/\.pdf$/i, ""), file_path: path, file_name: file.name,
        fields: CERT_FIELD_KEYS.slice(0, 3).map((f, i) => defaultField(f.key, i)) as any,
        is_default: templates.length === 0, created_by: u.user?.id,
      }).select("id").single();
      if (e2) toast.error(e2.message); else { toast.success("Modelo enviado."); setSelectedId(data.id); }
    }
    setBusy(false);
    load();
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const { error } = await supabase.from("certificate_templates").update({
      name: draft.name, fields: draft.fields as any, track_ids: draft.track_ids, is_default: draft.is_default, is_active: draft.is_active,
    }).eq("id", draft.id);
    if (!error && draft.is_default) {
      await supabase.from("certificate_templates").update({ is_default: false }).neq("id", draft.id);
    }
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Configurações salvas."); load(); }
  };

  const preview = async () => {
    if (!draft) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("generate-certificate", {
      body: { mode: "preview", template_id: draft.id, fields: draft.fields, origin: window.location.origin },
    });
    setBusy(false);
    if (error || !(data instanceof Blob)) return toast.error("Não foi possível gerar a prévia.");
    setPreviewUrl(URL.createObjectURL(new Blob([data], { type: "application/pdf" })));
  };

  const setField = (i: number, patch: Partial<CertField>) =>
    setDraft((d) => d && { ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const viewCert = async (c: any, force = false) => {
    try {
      const url = await openCertificatePdf({ certificateId: c.id, force });
      window.open(url, "_blank");
      if (force) toast.success("Certificado reemitido com o mesmo código.");
    } catch (e) { toast.error((e as Error).message); }
    load();
  };

  const revoke = async (c: any) => {
    const reason = prompt("Revogar este certificado? Ele deixará de ser válido na validação pública.\n\nInforme o motivo da revogação:");
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("Informe o motivo da revogação."); return; }
    const { error } = await supabase.rpc("admin_revoke_certificate", { _id: c.id, _reason: reason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Certificado revogado."); load();
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return certs.filter((c) =>
      (names[c.user_id] || "").toLowerCase().includes(s) || (c.tracks?.title || "").toLowerCase().includes(s) || (c.certificate_code || "").toLowerCase().includes(s));
  }, [certs, names, search]);

  const statusBadge = (c: any) => {
    if (c.revoked_at) return <Badge variant="destructive">Revogado</Badge>;
    if (c.status === "issued") return <Badge className="bg-success text-success-foreground">Emitido</Badge>;
    if (c.status === "failed") return <Badge variant="destructive" title={c.generation_error || ""}>Falhou</Badge>;
    return <Badge variant="secondary">Aguardando PDF</Badge>;
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="font-display text-xl font-bold text-primary">Certificados</h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
      </div>

      <Tabs defaultValue="modelos" className="mt-4">
        <TabsList>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="emitidos">Emitidos ({certs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="space-y-4">
          <div className="card-surface p-4 flex flex-wrap items-center gap-3">
            <Select value={selectedId || ""} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} (v{t.version}){t.is_default ? " · padrão" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="inline-flex">
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ""; }} />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                <FileUp className="h-4 w-4" /> Enviar modelo oficial (PDF)
              </span>
            </label>
            {templates.length === 0 && <p className="text-xs text-muted-foreground">Envie o PDF oficial da Nexti. O design original é preservado; apenas os dados do aluno são escritos por cima.</p>}
          </div>

          {draft && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="card-surface p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Nome do modelo</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                  <div className="flex items-end gap-2">
                    <label className="inline-flex">
                      <input type="file" accept="application/pdf,.pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f, draft.id); e.target.value = ""; }} />
                      <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                        <RefreshCw className="h-4 w-4" /> Substituir PDF (nova versão)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={draft.is_default} onCheckedChange={(v) => setDraft({ ...draft, is_default: !!v })} /> Usar em todos os cursos sem modelo próprio</label>
                  <label className="flex items-center gap-2"><Checkbox checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: !!v })} /> Ativo</label>
                </div>

                <div>
                  <Label>Cursos que usam este modelo</Label>
                  <div className="mt-1 max-h-36 overflow-auto rounded-md border border-border p-2 grid gap-1 sm:grid-cols-2">
                    {tracks.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-xs">
                        <Checkbox checked={draft.track_ids.includes(t.id)} onCheckedChange={(v) =>
                          setDraft({ ...draft, track_ids: v ? [...draft.track_ids, t.id] : draft.track_ids.filter((x) => x !== t.id) })} />
                        <span className="truncate">{t.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Campos automáticos</Label>
                    <Select onValueChange={(k) => setDraft({ ...draft, fields: [...draft.fields, defaultField(k, draft.fields.length)] })}>
                      <SelectTrigger className="w-48 h-8 text-xs"><Plus className="h-3 w-3" /><SelectValue placeholder="Adicionar campo" /></SelectTrigger>
                      <SelectContent>{CERT_FIELD_KEYS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Posições em % da página (0 = esquerda/topo, 100 = direita/base). "Largura máx." limita o espaço: textos longos diminuem e, se preciso, quebram em duas linhas.</p>
                  {draft.fields.map((f, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{CERT_FIELD_KEYS.find((k) => k.key === f.key)?.label || f.key}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([["x", "Horizontal %"], ["y", "Vertical %"], ["maxWidth", "Largura máx. %"]] as const).map(([k, l]) => (
                          <div key={k}><Label className="text-[10px]">{l}</Label>
                            <Input type="number" min={0} max={100} step={0.5} className="h-8 text-xs" value={Math.round((f[k] as number) * 1000) / 10}
                              onChange={(e) => setField(i, { [k]: Math.min(100, Math.max(0, Number(e.target.value))) / 100 } as any)} /></div>
                        ))}
                        <div><Label className="text-[10px]">Tamanho</Label>
                          <Input type="number" min={4} max={96} className="h-8 text-xs" value={f.size} onChange={(e) => setField(i, { size: Number(e.target.value) })} /></div>
                        <div className="col-span-2"><Label className="text-[10px]">Fonte</Label>
                          <Select value={f.font} onValueChange={(v) => setField(i, { font: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{CERT_FONTS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                          </Select></div>
                        <div><Label className="text-[10px]">Alinhamento</Label>
                          <Select value={f.align} onValueChange={(v: any) => setField(i, { align: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="left">Esquerda</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="right">Direita</SelectItem></SelectContent>
                          </Select></div>
                        <div><Label className="text-[10px]">Cor</Label>
                          <Input type="color" className="h-8 p-1" value={f.color} onChange={(e) => setField(i, { color: e.target.value })} /></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={preview} disabled={busy} className="gap-2"><Eye className="h-4 w-4" /> Gerar prévia</Button>
                  <Button onClick={save} disabled={busy} className="gap-2 bg-gradient-nexti text-primary-foreground"><Save className="h-4 w-4" /> Salvar configurações</Button>
                </div>
              </div>

              <div className="card-surface p-2 min-h-[420px]">
                {previewUrl ? (
                  <iframe src={previewUrl} title="Prévia do certificado" className="h-[70vh] w-full rounded-md border-0" />
                ) : (
                  <div className="flex h-full min-h-[400px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Clique em "Gerar prévia" para ver o modelo oficial preenchido com dados de exemplo.
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="emitidos" className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por aluno, curso ou código" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="card-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr><th className="p-3">Aluno</th><th className="p-3">Curso</th><th className="p-3">Conclusão/Emissão</th><th className="p-3">Código</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="p-3">{names[c.user_id] || "—"}</td>
                    <td className="p-3">{c.tracks?.title}</td>
                    <td className="p-3 text-xs">{new Date(c.issued_at).toLocaleDateString("pt-BR")}{c.generated_at ? ` · PDF ${new Date(c.generated_at).toLocaleDateString("pt-BR")}` : ""}</td>
                    <td className="p-3 font-mono text-xs">{c.certificate_code}</td>
                    <td className="p-3">{statusBadge(c)}{c.status === "failed" && <p className="mt-1 max-w-[220px] text-[10px] text-destructive">{c.generation_error}</p>}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {!c.revoked_at && <>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => viewCert(c)}><Eye className="h-3.5 w-3.5" /> Ver</Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1" title="Reemitir PDF (mantém o código)" onClick={() => viewCert(c, true)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Revogar" onClick={() => revoke(c)}><Ban className="h-3.5 w-3.5 text-destructive" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum certificado encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminCertificados;
