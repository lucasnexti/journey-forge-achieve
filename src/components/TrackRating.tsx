import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TrackRatingProps {
  trackId: string;
}

const TrackRating = ({ trackId }: TrackRatingProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSaving(true);

    await supabase.from("track_ratings").upsert(
      { user_id: user.id, track_id: trackId, rating, comment: comment || null },
      { onConflict: "user_id,track_id" }
    );

    setSaving(false);
    setSubmitted(true);
    toast.success("Obrigado pela avaliação!");
  };

  if (submitted) {
    return (
      <div className="card-surface p-5 text-center">
        <p className="text-sm text-success font-medium">✓ Obrigado pela sua avaliação!</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <h4 className="font-display text-sm font-semibold text-foreground mb-3">Avalie esta trilha</h4>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="transition-colors"
          >
            <Star
              className={`h-6 w-6 ${
                n <= (hover || rating)
                  ? "fill-warning text-warning"
                  : "text-border"
              }`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Deixe um comentário (opcional)"
        rows={2}
        className="resize-none text-sm mb-3"
      />
      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || saving}
        size="sm"
        className="w-full bg-gradient-nexti text-primary-foreground hover:opacity-90"
      >
        {saving ? "Enviando..." : "Enviar Avaliação"}
      </Button>
    </div>
  );
};

export default TrackRating;
