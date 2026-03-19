import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, X, GripVertical, Video } from "lucide-react";

interface Track {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  estimated_hours: number | null;
  order_index: number | null;
  is_active: boolean | null;
}

interface Lesson {
  id: string;
  track_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration: number | null;
  order_index: number | null;
}

const AdminTrilhasGestao = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [showNewTrack, setShowNewTrack] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({ title: "", description: "", video_url: "", duration: 0 });
  const [showNewLesson, setShowNewLesson] = useState(false);

  // New track form
  const [newTrack, setNewTrack] = useState({ title: "", description: "", category: "", estimated_hours: 0 });

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    if (selectedTrackId) fetchLessons(selectedTrackId);
  }, [selectedTrackId]);

  const fetchTracks = async () => {
    setLoading(true);
    const { data } = await supabase.from("tracks").select("*").order("order_index");
    if (data) setTracks(data);
    setLoading(false);
  };

  const fetchLessons = async (trackId: string) => {
    const { data } = await supabase.from("lessons").select("*").eq("track_id", trackId).order("order_index");
    if (data) setLessons(data);
  };

  const handleCreateTrack = async () => {
    if (!newTrack.title.trim()) { toast.error("Informe o título da trilha."); return; }
    const { error } = await supabase.from("tracks").insert({
      title: newTrack.title,
      description: newTrack.description || null,
      category: newTrack.category || null,
      estimated_hours: newTrack.estimated_hours,
      order_index: tracks.length + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Trilha criada!");
      setNewTrack({ title: "", description: "", category: "", estimated_hours: 0 });
      setShowNewTrack(false);
      fetchTracks();
    }
  };

  const handleUpdateTrack = async () => {
    if (!editingTrack) return;
    const { error } = await supabase.from("tracks").update({
      title: editingTrack.title,
      description: editingTrack.description,
      category: editingTrack.category,
      estimated_hours: editingTrack.estimated_hours,
      is_active: editingTrack.is_active,
    }).eq("id", editingTrack.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Trilha atualizada!");
      setEditingTrack(null);
      fetchTracks();
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!confirm("Excluir esta trilha e todas as suas aulas?")) return;
    const { error } = await supabase.from("tracks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Trilha excluída.");
      if (selectedTrackId === id) { setSelectedTrackId(null); setLessons([]); }
      fetchTracks();
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedTrackId || !newLesson.title.trim()) { toast.error("Informe o título da aula."); return; }
    const { error } = await supabase.from("lessons").insert({
      track_id: selectedTrackId,
      title: newLesson.title,
      description: newLesson.description || null,
      video_url: newLesson.video_url || null,
      duration: newLesson.duration,
      order_index: lessons.length + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Aula adicionada!");
      setNewLesson({ title: "", description: "", video_url: "", duration: 0 });
      setShowNewLesson(false);
      fetchLessons(selectedTrackId);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Aula excluída.");
      if (selectedTrackId) fetchLessons(selectedTrackId);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Gestão de Trilhas</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <Button onClick={() => setShowNewTrack(!showNewTrack)} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          {showNewTrack ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNewTrack ? "Cancelar" : "Nova Trilha"}
        </Button>
      </div>

      {/* New track form */}
      {showNewTrack && (
        <div className="mt-6 card-surface p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Criar Nova Trilha</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={newTrack.title} onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })} placeholder="Nome da trilha" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={newTrack.category} onChange={(e) => setNewTrack({ ...newTrack, category: e.target.value })} placeholder="Ex: Gestão, Finanças" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={newTrack.description} onChange={(e) => setNewTrack({ ...newTrack, description: e.target.value })} placeholder="Descreva a trilha..." rows={2} />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Horas estimadas</Label>
            <Input type="number" value={newTrack.estimated_hours} onChange={(e) => setNewTrack({ ...newTrack, estimated_hours: Number(e.target.value) })} />
          </div>
          <Button onClick={handleCreateTrack} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-4 w-4 mr-1" /> Criar Trilha
          </Button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Track list */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Trilhas ({tracks.length})</h3>
          {loading ? (
            <div className="card-surface p-12 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={`card-surface p-4 cursor-pointer transition-colors ${
                    selectedTrackId === track.id ? "ring-2 ring-primary" : "hover:bg-secondary/30"
                  } ${!track.is_active ? "opacity-50" : ""}`}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  {editingTrack?.id === track.id ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <Input value={editingTrack.title} onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })} />
                      <Textarea value={editingTrack.description || ""} onChange={(e) => setEditingTrack({ ...editingTrack, description: e.target.value })} rows={2} />
                      <div className="flex gap-2">
                        <Input value={editingTrack.category || ""} onChange={(e) => setEditingTrack({ ...editingTrack, category: e.target.value })} placeholder="Categoria" />
                        <Input type="number" value={editingTrack.estimated_hours || 0} onChange={(e) => setEditingTrack({ ...editingTrack, estimated_hours: Number(e.target.value) })} className="w-24" />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editingTrack.is_active ?? true} onChange={(e) => setEditingTrack({ ...editingTrack, is_active: e.target.checked })} />
                        Ativa
                      </label>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateTrack} className="bg-primary text-primary-foreground"><Save className="h-3 w-3 mr-1" /> Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTrack(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{track.title}</p>
                          <p className="text-xs text-muted-foreground">{track.category} · {track.estimated_hours}h</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditingTrack(track)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTrack(track.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lessons for selected track */}
        <div>
          {selectedTrackId ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Aulas ({lessons.length})
                </h3>
                <Button size="sm" variant="outline" onClick={() => setShowNewLesson(!showNewLesson)} className="gap-1">
                  {showNewLesson ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showNewLesson ? "Cancelar" : "Nova Aula"}
                </Button>
              </div>

              {showNewLesson && (
                <div className="card-surface p-4 mb-3 space-y-3">
                  <Input value={newLesson.title} onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })} placeholder="Título da aula *" />
                  <Input value={newLesson.description} onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })} placeholder="Descrição" />
                  <Input value={newLesson.video_url} onChange={(e) => setNewLesson({ ...newLesson, video_url: e.target.value })} placeholder="URL do vídeo" />
                  <Input type="number" value={newLesson.duration} onChange={(e) => setNewLesson({ ...newLesson, duration: Number(e.target.value) })} placeholder="Duração (segundos)" className="max-w-xs" />
                  <Button size="sm" onClick={handleCreateLesson} className="bg-primary text-primary-foreground">
                    <Save className="h-3 w-3 mr-1" /> Adicionar Aula
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {lessons.length === 0 ? (
                  <div className="card-surface p-8 text-center text-sm text-muted-foreground">
                    Nenhuma aula cadastrada nesta trilha.
                  </div>
                ) : (
                  lessons.map((lesson, i) => (
                    <div key={lesson.id} className="card-surface p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                        <Video className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.duration ? `${Math.round(lesson.duration / 60)} min` : "—"}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="card-surface p-12 text-center text-sm text-muted-foreground">
              Selecione uma trilha para gerenciar suas aulas.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTrilhasGestao;
