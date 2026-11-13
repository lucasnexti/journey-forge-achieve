import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Rocket, User, BookOpen, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { queryKeys } from "@/hooks/useQueryKeys";
import { INTEREST_AREAS, toggleInterestArea } from "@/lib/onboarding";

interface OnboardingWizardProps {
  onComplete: () => void;
  initial?: { nome?: string | null; empresa?: string | null; cargo?: string | null };
}

const OnboardingWizard = ({ onComplete, initial }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [cargo, setCargo] = useState(initial?.cargo ?? "");
  const [empresa, setEmpresa] = useState(initial?.empresa ?? "");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setNome((v) => v || initial.nome || "");
    setEmpresa((v) => v || initial.empresa || "");
    setCargo((v) => v || initial.cargo || "");
  }, [initial?.nome, initial?.empresa, initial?.cargo]);

  const handleComplete = async () => {
    if (!user || saving) return;
    setSaving(true);
    const { error } = await supabase.rpc("complete_onboarding", {
      _nome: nome,
      _workplace_empresa: empresa,
      _cargo: cargo,
      _interest_areas: interests,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível salvar. Tente novamente.");
      return;
    }
    queryClient.setQueryData(queryKeys.profile.user(user.id), (old: Record<string, unknown> | null | undefined) =>
      old ? { ...old, onboarding_completed: true, interest_areas: interests } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Perfil concluído com sucesso! Bem-vindo à Universidade Nexti!");
    onComplete();
    navigate("/dashboard", { replace: true });
  };

  const steps = [
    // Step 0: Welcome
    <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-nexti">
        <Rocket className="h-10 w-10 text-primary-foreground" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Bem-vindo à Universidade Nexti!</h2>
        <p className="mt-2 text-muted-foreground">Vamos configurar seu perfil em poucos passos para personalizar sua experiência.</p>
      </div>
      <Button onClick={() => setStep(1)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
        Começar <ChevronRight className="h-4 w-4" />
      </Button>
    </motion.div>,

    // Step 1: Profile info
    <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center">
        <User className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-2 font-display text-xl font-bold text-foreground">Complete seu Perfil</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="onb-nome">Nome completo</Label>
          <Input id="onb-nome" maxLength={255} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onb-empresa">Empresa</Label>
            <Input id="onb-empresa" maxLength={255} value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Sua empresa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-cargo">Cargo</Label>
            <Input id="onb-cargo" maxLength={255} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Seu cargo" />
          </div>
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <Button onClick={() => setStep(2)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>,

    // Step 2: Interests
    <motion.div key="interests" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center">
        <BookOpen className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-2 font-display text-xl font-bold text-foreground">Áreas de Interesse</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione uma ou mais áreas que mais te interessam</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="Áreas de interesse">
        {INTEREST_AREAS.map((area) => {
          const selected = interests.includes(area.key);
          return (
            <button
              type="button"
              key={area.key}
              aria-pressed={selected}
              onClick={() => setInterests((prev) => toggleInterestArea(prev, area.key))}
              className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <span className={`flex items-start gap-2 pr-6 text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
                {area.label}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{area.description}</span>
              {selected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <span className="text-xs text-muted-foreground">
          {interests.length > 0 ? `${interests.length} selecionada${interests.length > 1 ? "s" : ""}` : ""}
        </span>
        <Button onClick={handleComplete} disabled={saving} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {saving ? "Salvando..." : "Concluir"} <Check className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>,
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`w-full p-2 sm:p-6 ${step === 2 ? "max-w-2xl" : "max-w-md"}`}>
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-border"}`} />
            ))}
          </div>

          <div className="card-surface p-6 sm:p-8">
            <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
