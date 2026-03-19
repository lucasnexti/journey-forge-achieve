import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Palette } from "lucide-react";

const DEFAULT_SETTINGS = [
  { key: "platform_name", label: "Nome da Plataforma", value: "Nexti Universidade" },
  { key: "primary_color", label: "Cor Primária (HSL)", value: "18 100% 55%" },
  { key: "accent_color", label: "Cor de Destaque (HSL)", value: "28 100% 55%" },
  { key: "logo_url", label: "URL do Logo", value: "" },
  { key: "welcome_message", label: "Mensagem de Boas-Vindas", value: "Bem-vindo à plataforma de treinamento!" },
];

const AdminPersonalizacao = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from("platform_settings").select("*");
    const map: Record<string, string> = {};
    DEFAULT_SETTINGS.forEach(s => { map[s.key] = s.value; });
    if (data) data.forEach((s: any) => { map[s.key] = s.value || ""; });
    setSettings(map);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id || "";

    for (const [key, value] of Object.entries(settings)) {
      await supabase.from("platform_settings").upsert(
        { key, value, updated_by: userId, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }
    toast.success("Configurações salvas!");
    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Personalização</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-2 text-sm text-muted-foreground">Configure a aparência e mensagens da plataforma.</p>
        </div>
      </div>

      <div className="mt-6 card-surface p-6 space-y-6">
        {DEFAULT_SETTINGS.map(setting => (
          <div key={setting.key} className="space-y-2">
            <Label className="flex items-center gap-2">
              {setting.key.includes("color") && <Palette className="h-3.5 w-3.5 text-primary" />}
              {setting.label}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                value={settings[setting.key] || ""}
                onChange={e => setSettings({ ...settings, [setting.key]: e.target.value })}
                placeholder={setting.value}
                className="max-w-lg"
              />
              {setting.key.includes("color") && settings[setting.key] && (
                <div className="h-9 w-9 rounded-lg border border-border" style={{ background: `hsl(${settings[setting.key]})` }} />
              )}
            </div>
          </div>
        ))}

        {/* Preview */}
        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Preview</h3>
          <div className="card-surface p-6 rounded-xl" style={{ borderColor: settings.primary_color ? `hsl(${settings.primary_color})` : undefined }}>
            <h2 className="font-display text-lg font-bold" style={{ color: settings.primary_color ? `hsl(${settings.primary_color})` : undefined }}>
              {settings.platform_name || "Nexti Universidade"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{settings.welcome_message}</p>
            <div className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground"
              style={{ background: settings.accent_color ? `hsl(${settings.accent_color})` : undefined }}>
              Botão de exemplo
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AdminPersonalizacao;
