import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Send, MessageSquare } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SurveyModalProps {
  open: boolean;
  onClose: () => void;
  survey: {
    id: string;
    type: "csat";
    question: string;
    title: string;
  };
  context?: Record<string, string>;
}

const CSAT_LABELS = ["Muito insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito satisfeito"];

export const SurveyModal = ({ open, onClose, survey, context }: SurveyModalProps) => {
  const { user } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"score" | "comment" | "thanks">("score");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === null || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("survey_responses").insert({
        survey_id: survey.id,
        user_id: user.id,
        score,
        comment: comment.trim() || null,
        context: context || {},
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Você já respondeu esta pesquisa.");
        } else {
          throw error;
        }
      }
      setStep("thanks");
    } catch {
      toast.error("Erro ao enviar resposta.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === "score") setStep("comment");
    else if (step === "comment") handleSubmit();
  };

  const handleClose = () => {
    setScore(null);
    setComment("");
    setStep("score");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0">
        <AnimatePresence mode="wait">
          {step === "thanks" ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center p-8 text-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Obrigado pelo seu feedback!</h3>
              <p className="text-muted-foreground text-sm">Sua opinião é muito importante para melhorarmos continuamente.</p>
              <Button onClick={handleClose} className="mt-2">Fechar</Button>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: step === "comment" ? 30 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Pesquisa CSAT
                </span>
                <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{survey.title}</h3>
              <p className="text-sm text-muted-foreground mb-6">{survey.question}</p>

              {step === "score" && (
                <div className="space-y-4">
                  <div className="flex gap-3 justify-center">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        onClick={() => setScore(i)}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <Star
                          className={cn(
                            "w-10 h-10 transition-all duration-200",
                            score !== null && i <= score
                              ? "fill-yellow-400 text-yellow-400 scale-110"
                              : "text-muted-foreground/40 group-hover:text-yellow-300"
                          )}
                        />
                        <span className="text-[10px] text-muted-foreground max-w-[60px] text-center leading-tight">
                          {CSAT_LABELS[i - 1]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === "comment" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="w-4 h-4" />
                    <span>Deseja deixar um comentário? (opcional)</span>
                  </div>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Conte-nos mais sobre sua experiência..."
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                {step === "comment" && (
                  <Button variant="ghost" onClick={() => setStep("score")}>Voltar</Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={score === null || submitting}
                >
                  {step === "score" ? "Próximo" : submitting ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default SurveyModal;
