import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, ExternalLink } from "lucide-react";

interface LessonMaterialsProps {
  lessonId: string;
}

const LessonMaterials = ({ lessonId }: LessonMaterialsProps) => {
  const [materials, setMaterials] = useState<{ id: string; title: string; url: string; type: string }[]>([]);

  useEffect(() => {
    supabase
      .from("lesson_materials")
      .select("id, title, url, type")
      .eq("lesson_id", lessonId)
      .then(({ data }) => setMaterials(data || []));
  }, [lessonId]);

  if (materials.length === 0) return null;

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold text-foreground">Material Complementar</h4>
      </div>
      <div className="space-y-2">
        {materials.map((m) => (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{m.title}</span>
            <span className="text-xs text-muted-foreground uppercase">{m.type}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default LessonMaterials;
