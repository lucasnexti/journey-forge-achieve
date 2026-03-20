import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, BookOpen, Play, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "track" | "lesson" | "material";
  id: string;
  title: string;
  subtitle?: string;
  trackId?: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      const term = `%${debouncedQuery}%`;

      const [tracksRes, lessonsRes, materialsRes] = await Promise.all([
        supabase
          .from("tracks")
          .select("id, title, category")
          .eq("is_active", true)
          .ilike("title", term)
          .limit(5),
        supabase
          .from("lessons")
          .select("id, title, track_id, tracks(title)")
          .ilike("title", term)
          .limit(5),
        supabase
          .from("lesson_materials")
          .select("id, title, lesson_id, lessons(track_id, tracks(title))")
          .ilike("title", term)
          .limit(5),
      ]);

      const items: SearchResult[] = [
        ...(tracksRes.data || []).map((t: any) => ({
          type: "track" as const,
          id: t.id,
          title: t.title,
          subtitle: t.category || "Trilha",
        })),
        ...(lessonsRes.data || []).map((l: any) => ({
          type: "lesson" as const,
          id: l.id,
          title: l.title,
          subtitle: l.tracks?.title || "Aula",
          trackId: l.track_id,
        })),
        ...(materialsRes.data || []).map((m: any) => ({
          type: "material" as const,
          id: m.id,
          title: m.title,
          subtitle: (m.lessons as any)?.tracks?.title || "Material",
          trackId: (m.lessons as any)?.track_id,
        })),
      ];

      setResults(items);
      setLoading(false);
    };

    search();
  }, [debouncedQuery]);

  const handleSelect = (item: SearchResult) => {
    if (item.type === "track") {
      navigate(`/trilha/${item.id}`);
    } else if (item.trackId) {
      navigate(`/trilha/${item.trackId}`);
    }
    setOpen(false);
    setQuery("");
  };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const iconMap = {
    track: BookOpen,
    lesson: Play,
    material: FileText,
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar trilhas, aulas, materiais..."
          className="pl-9 pr-8 h-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum resultado encontrado</div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {results.map((item) => {
                const Icon = iconMap[item.type];
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/10 transition-colors"
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.type === "track" ? "bg-primary/10 text-primary" :
                      item.type === "lesson" ? "bg-success/10 text-success" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {item.type === "track" ? "Trilha" : item.type === "lesson" ? "Aula" : "Material"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
