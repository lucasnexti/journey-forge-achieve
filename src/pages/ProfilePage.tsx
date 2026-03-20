import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Award, FileText, Save, Camera, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

interface ProfileData {
  nome: string;
  cpf: string | null;
  empresa: string | null;
  cargo: string | null;
  avatar_url: string | null;
}

const ProfilePage = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileData>({ nome: "", cpf: null, empresa: null, cargo: null, avatar_url: null });
  const [badges, setBadges] = useState<{ name: string; icon: string; earned_at: string }[]>([]);
  const [certificates, setCertificates] = useState<{ id: string; track_title: string; issued_at: string; certificate_code: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;

    // Delete old avatar if exists
    await supabase.storage.from("avatars").remove([filePath]).catch(() => {});

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar imagem: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

    await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", user.id);

    setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
    setUploadingAvatar(false);
    toast.success("Foto atualizada!");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </AppLayout>
      </div>
    );
  }

  return (
    <AppLayout>

      <div className="bg-gradient-nexti">
        <div className="container py-6 sm:py-10">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Avatar with upload */}
            <div className="relative group shrink-0">
              <div className="flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-primary-foreground/20 border-2 border-primary-foreground/30 overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                )}
              </AppLayout>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl font-extrabold text-primary-foreground truncate">{profile.nome}</h1>
              <p className="text-xs sm:text-sm text-primary-foreground/80 truncate">{profile.cargo || "Sem cargo"} · {profile.empresa || "Sem empresa"}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Edit profile */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="card-surface p-4 sm:p-6">
              <h2 className="font-display text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados Pessoais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm font-medium text-foreground">Nome</Label>
                  <Input value={profile.nome} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm font-medium text-foreground">Cargo</Label>
                  <Input value={profile.cargo || ""} onChange={(e) => setProfile({ ...profile, cargo: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">CPF</Label>
                  <Input value={profile.cpf || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Empresa</Label>
                  <Input value={profile.empresa || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">E-mail</Label>
                  <Input value={user?.email || ""} disabled className="bg-muted/50" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="mt-4 gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90 w-full sm:w-auto">
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>

            {/* Change Password */}
            <div className="card-surface p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="font-display text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Segurança
                </h2>
                {!showPasswordSection && (
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordSection(true)} className="text-xs">
                    Alterar Senha
                  </Button>
                )}
              </div>

              {showPasswordSection ? (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Nova senha *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Confirmar nova senha *</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={changingPassword} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
                      <KeyRound className="h-4 w-4" />
                      {changingPassword ? "Salvando..." : "Alterar Senha"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowPasswordSection(false); setNewPassword(""); setConfirmPassword(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Sua conta está protegida. Clique em "Alterar Senha" para modificar.</p>
              )}
            </div>

            {/* Certificates */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="font-display text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Meus Certificados
              </h2>
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum certificado emitido ainda. Conclua uma trilha para receber seu certificado.</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 sm:p-4 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cert.track_title}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">
                          Emitido em {new Date(cert.issued_at).toLocaleDateString("pt-BR")} · Código: {cert.certificate_code?.slice(0, 8)}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-4 sm:space-y-6">
            <div className="card-surface p-4 sm:p-6">
              <h2 className="font-display text-sm sm:text-base font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Conquistas
              </h2>
              {badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conquista ainda. Continue estudando!</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {badges.map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 p-3 sm:p-4 text-center">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-warning/10">
                        <Award className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                      </div>
                      <p className="text-[11px] sm:text-xs font-medium text-foreground">{b.name}</p>
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
