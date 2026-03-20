import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote, Save, Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NoteRow {
  id: string;
  content: string;
  timestamp_seconds: number | null;
  created_at: string | null;
}

interface LessonNotesProps {
  lessonId: string;
  currentTime?: number;
  onSeek?: (seconds: number) => void;
}

const formatTimestamp = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const LessonNotes = ({ lessonId, currentTime = 0, onSeek }: LessonNotesProps) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lesson_notes")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        // Cast to include timestamp_seconds which may not be in types yet
        setNotes(((data as any[]) || []).map((d: any) => ({
          id: d.id,
          content: d.content,
          timestamp_seconds: d.timestamp_seconds ?? null,
          created_at: d.created_at,
        })));
      });
  }, [user, lessonId]);

  const handleSave = async (withTimestamp: boolean) => {
    if (!user || !newContent.trim()) return;
    setSaving(true);

    const insertData: any = {
      user_id: user.id,
      lesson_id: lessonId,
      content: newContent.trim(),
    };
    if (withTimestamp && currentTime > 0) {
      insertData.timestamp_seconds = Math.round(currentTime);
    }

    const { data } = await (supabase
      .from("lesson_notes")
      .insert(insertData as any)
      .select("id, content, created_at")
      .single());

    if (data) {
      const row = data as any;
      setNotes((prev) => [...prev, {
        id: row.id, content: row.content,
        timestamp_seconds: row.timestamp_seconds ?? insertData.timestamp_seconds ?? null,
        created_at: row.created_at,
      }]);
      setNewContent("");
    }

    setSaving(false);
    toast.success("Anotação salva!");
  };

  const handleDelete = async (noteId: string) => {
    await supabase.from("lesson_notes").delete().eq("id", noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold text-foreground">Minhas Anotações</h4>
        {notes.length > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{notes.length}</span>
        )}
      </div>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group flex items-start gap-2 rounded-lg border border-border/50 p-2.5 text-sm hover:bg-muted/30 transition-colors"
            >
              {note.timestamp_seconds != null && (
                <button
                  onClick={() => onSeek?.(note.timestamp_seconds!)}
                  className="flex items-center gap-1 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors tabular-nums"
                >
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(note.timestamp_seconds)}
                </button>
              )}
              <p className="flex-1 text-foreground/80 text-xs leading-relaxed whitespace-pre-wrap">{note.content}</p>
              <button
                onClick={() => handleDelete(note.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New note */}
      <Textarea
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        placeholder="Faça suas anotações sobre esta aula..."
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex gap-2 mt-2">
        <Button
          onClick={() => handleSave(true)}
          size="sm"
          disabled={saving || !newContent.trim()}
          className="gap-1.5 flex-1"
          variant="outline"
        >
          <Clock className="h-3.5 w-3.5" />
          Salvar em {formatTimestamp(currentTime)}
        </Button>
        <Button
          onClick={() => handleSave(false)}
          size="sm"
          disabled={saving || !newContent.trim()}
          className="gap-1.5"
          variant="ghost"
        >
          <Save className="h-3.5 w-3.5" />
          Sem tempo
        </Button>
      </div>
    </div>
  );
};

export default LessonNotes;
