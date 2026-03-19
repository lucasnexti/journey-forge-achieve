import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2, Search, Award } from "lucide-react";

const AdminCertificados = () => {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newCert, setNewCert] = useState({ user_id: "", track_id: "", valid_months: 12 });
  const [search, setSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [certsRes, tracksRes, profilesRes] = await Promise.all([
      supabase.from("certificates").select("*, tracks(title)").order("issued_at", { ascending: false }),
      supabase.from("tracks").select("id, title").eq("is_active", true),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    if (certsRes.data) setCertificates(certsRes.data);
    if (tracksRes.data) setTracks(tracksRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  };

  const getUserName = (userId: string) => profiles.find(p => p.user_id === userId)?.nome || userId.substring(0, 8);

  const handleIssueCert = async () => {
    if (!newCert.user_id || !newCert.track_id) { toast.error("Selecione usuário e trilha."); return; }
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + newCert.valid_months);
    const { error } = await supabase.from("certificates").insert({
      user_id: newCert.user_id,
      track_id: newCert.track_id,
      valid_until: validUntil.toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Certificado emitido!");
    setShowNew(false);
    setNewCert({ user_id: "", track_id: "", valid_months: 12 });
    fetchAll();

    await supabase.from("audit_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "issue_certificate",
      entity_type: "certificate",
      details: { for_user: newCert.user_id, track: newCert.track_id },
    });
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revogar este certificado?")) return;
    await supabase.from("certificates").delete().eq("id", id);
    toast.success("Certificado revogado.");
    fetchAll();
  };

  const filtered = certificates.filter(c =>
    getUserName(c.user_id).toLowerCase().includes(search.toLowerCase()) ||
    (c.tracks?.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Certificados</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <Button onClick={() => setShowNew(!showNew)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Emitir Certificado
        </Button>
      </div>

      {showNew && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Usuário *</Label>
              <Select value={newCert.user_id} onValueChange={v => setNewCert({ ...newCert, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trilha *</Label>
              <Select value={newCert.track_id} onValueChange={v => setNewCert({ ...newCert, track_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Validade (meses)</Label>
              <Input type="number" value={newCert.valid_months} onChange={e => setNewCert({ ...newCert, valid_months: Number(e.target.value) })} />
            </div>
          </div>
          <Button onClick={handleIssueCert} className="bg-primary text-primary-foreground"><Award className="h-4 w-4 mr-1" /> Emitir</Button>
        </div>
      )}

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="mt-6 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum certificado emitido.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Trilha</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Emissão</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Validade</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Código</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-4 text-sm font-medium text-foreground">{getUserName(c.user_id)}</td>
                  <td className="px-5 py-4 text-sm text-foreground">{c.tracks?.title}</td>
                  <td className="px-5 py-4 text-sm tabular-nums text-muted-foreground">{new Date(c.issued_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-4 text-sm tabular-nums text-muted-foreground">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("pt-BR") : "Permanente"}</td>
                  <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{c.certificate_code?.substring(0, 12)}...</td>
                  <td className="px-5 py-4">
                    <button onClick={() => handleRevoke(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCertificados;
