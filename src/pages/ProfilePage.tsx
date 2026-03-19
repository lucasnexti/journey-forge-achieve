import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Award, FileText, Save, Camera } from "lucide-react";

interface ProfileData {
  nome: string;
  cpf: string | null;
  empresa: string | null;
  cargo: string | null;
  avatar_url: string | null;
}

const ProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({ nome: "", cpf: null, empresa: null, cargo: null, avatar_url: null });
  const [badges, setBadges] = useState<{ name: string; icon: string; earned_at: string }[]>([]);
  const [certificates, setCertificates] = useState<{ id: string; track_title: string; issued_at: string; certificate_code: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: profileData }, { data: badgeData }, { data: certData }] = await Promise.all([
        supabase.from("profiles").select("nome, cpf, empresa, cargo, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_badges").select("earned_at, badges(name, icon)").eq("user_id", user.id),
        supabase.from("certificates").select("id, issued_at, certificate_code, tracks(title)").eq("user_id", user.id),
      ]);

      if (profileData) setProfile(profileData);
      setBadges(
        (badgeData || []).map((b: any) => ({
          name: b.badges?.name || "",
          icon: b.badges?.icon || "award",
          earned_at: b.earned_at,
        }))
      );
      setCertificates(
        (certData || []).map((c: any) => ({
          id: c.id,
          track_title: c.tracks?.title || "",
          issued_at: c.issued_at,
          certificate_code: c.certificate_code,
        }))
      );
      setLoading(false);
    };

    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ nome: profile.nome, cargo: profile.cargo })
      .eq("user_id", user.id);
    setSaving(false);
    toast.success("Perfil atualizado!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="bg-gradient-nexti">
        <div className="container py-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20 border-2 border-primary-foreground/30">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-primary-foreground">{profile.nome}</h1>
              <p className="text-sm text-primary-foreground/80">{profile.cargo || "Sem cargo"} · {profile.empresa || "Sem empresa"}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Edit profile */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados Pessoais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Nome</Label>
                  <Input value={profile.nome} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Cargo</Label>
                  <Input value={profile.cargo || ""} onChange={(e) => setProfile({ ...profile, cargo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">CPF</Label>
                  <Input value={profile.cpf || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Empresa</Label>
                  <Input value={profile.empresa || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">E-mail</Label>
                  <Input value={user?.email || ""} disabled className="bg-muted/50" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="mt-4 gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>

            {/* Certificates */}
            <div className="card-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Meus Certificados
              </h2>
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum certificado emitido ainda. Conclua uma trilha para receber seu certificado.</p>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{cert.track_title}</p>
                        <p className="text-xs text-muted-foreground">
                          Emitido em {new Date(cert.issued_at).toLocaleDateString("pt-BR")} · Código: {cert.certificate_code?.slice(0, 8)}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-6">
            <div className="card-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Conquistas
              </h2>
              {badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conquista ainda. Continue estudando!</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {badges.map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-4 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                        <Award className="h-5 w-5 text-warning" />
                      </div>
                      <p className="text-xs font-medium text-foreground">{b.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(b.earned_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
