import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Rocket, User, Building2, Briefcase, BookOpen, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const CATEGORIES = ["Fundamentos", "Gestão", "Finanças", "Tecnologia", "Liderança", "Compliance"];

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (cat: string) => {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({
        nome: nome || undefined,
        cargo: cargo || undefined,
        empresa: empresa || undefined,
        interests,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    setSaving(false);
    toast.success("Bem-vindo à Universidade Nexti!");
    onComplete();
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
          <Label>Nome completo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Sua empresa" />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Seu cargo" />
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
        <p className="mt-1 text-sm text-muted-foreground">Selecione as áreas que mais te interessam</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const selected = interests.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleInterest(cat)}
              className={`rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all ${
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {selected && <Check className="inline h-4 w-4 mr-1" />}
              {cat}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <Button onClick={handleComplete} disabled={saving} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {saving ? "Salvando..." : "Concluir"} <Check className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md p-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-border"}`} />
          ))}
        </div>

        <div className="card-surface p-8">
          <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
