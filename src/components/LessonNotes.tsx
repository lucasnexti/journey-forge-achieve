import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface LessonNotesProps {
  lessonId: string;
}

const LessonNotes = ({ lessonId }: LessonNotesProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lesson_notes")
      .select("id, content")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContent(data.content);
          setNoteId(data.id);
        } else {
          setContent("");
          setNoteId(null);
        }
      });
  }, [user, lessonId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    if (noteId) {
      await supabase
        .from("lesson_notes")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", noteId);
    } else {
      const { data } = await supabase
        .from("lesson_notes")
        .insert({ user_id: user.id, lesson_id: lessonId, content })
        .select("id")
        .single();
      if (data) setNoteId(data.id);
    }

    setSaving(false);
    toast.success("Anotação salva!");
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold text-foreground">Minhas Anotações</h4>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Faça suas anotações sobre esta aula..."
        rows={4}
        className="resize-none text-sm"
      />
      <Button
        onClick={handleSave}
        size="sm"
        disabled={saving}
        className="mt-2 gap-2 w-full"
        variant="outline"
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Salvando..." : "Salvar Anotação"}
      </Button>
    </div>
  );
};

export default LessonNotes;
