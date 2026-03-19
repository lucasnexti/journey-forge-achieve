import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Save, Search, BookOpen, Clock, Users, BarChart3,
  Video, GripVertical, Eye, EyeOff, ChevronRight, Layers, ArrowUpDown,
  FileText, ExternalLink, X
} from "lucide-react";

interface Track {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  estimated_hours: number | null;
  order_index: number | null;
  is_active: boolean | null;
  created_at: string | null;
  published_at: string | null;
  prerequisite_track_id: string | null;
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

interface TrackStats {
  lessonCount: number;
  enrollmentCount: number;
  completionCount: number;
}

const AdminTrilhasGestao = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [trackStats, setTrackStats] = useState<Record<string, TrackStats>>({});

  // Dialogs
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Forms
  const [trackForm, setTrackForm] = useState({ title: "", description: "", category: "", estimated_hours: 0, is_active: true, prerequisite_track_id: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", video_url: "", duration: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Global stats
  const [globalStats, setGlobalStats] = useState({ totalTracks: 0, activeTracks: 0, totalLessons: 0, totalEnrollments: 0 });

  useEffect(() => {
    fetchTracks();
    fetchGlobalStats();
  }, []);

  useEffect(() => {
    if (selectedTrackId) fetchLessons(selectedTrackId);
  }, [selectedTrackId]);

  const fetchTracks = async () => {
    setLoading(true);
    const { data } = await supabase.from("tracks").select("*").order("order_index");
    if (data) {
      setTracks(data);
      fetchTrackStats(data.map((t) => t.id));
    }
    setLoading(false);
  };

  const fetchGlobalStats = async () => {
    const [{ count: trackCount }, { count: activeCount }, { count: lessonCount }, { count: enrollCount }] = await Promise.all([
      supabase.from("tracks").select("*", { count: "exact", head: true }),
      supabase.from("tracks").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
      supabase.from("enrollments").select("*", { count: "exact", head: true }),
    ]);
    setGlobalStats({
      totalTracks: trackCount || 0,
      activeTracks: activeCount || 0,
      totalLessons: lessonCount || 0,
      totalEnrollments: enrollCount || 0,
    });
  };

  const fetchTrackStats = async (trackIds: string[]) => {
    const [{ data: lessonData }, { data: enrollData }] = await Promise.all([
      supabase.from("lessons").select("track_id"),
      supabase.from("enrollments").select("track_id, status"),
    ]);

    const stats: Record<string, TrackStats> = {};
    trackIds.forEach((id) => {
      const lCount = lessonData?.filter((l) => l.track_id === id).length || 0;
      const eCount = enrollData?.filter((e) => e.track_id === id).length || 0;
      const cCount = enrollData?.filter((e) => e.track_id === id && e.status === "completed").length || 0;
      stats[id] = { lessonCount: lCount, enrollmentCount: eCount, completionCount: cCount };
    });
    setTrackStats(stats);
  };

  const fetchLessons = async (trackId: string) => {
    const { data } = await supabase.from("lessons").select("*").eq("track_id", trackId).order("order_index");
    if (data) setLessons(data);
  };

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(tracks.map((t) => t.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [tracks]);

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? t.is_active : !t.is_active);
      const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [tracks, search, statusFilter, categoryFilter]);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  // ─── Track CRUD ───
  const openNewTrack = () => {
    setEditingTrack(null);
    setTrackForm({ title: "", description: "", category: "", estimated_hours: 0, is_active: true, prerequisite_track_id: "" });
    setTrackDialogOpen(true);
  };

  const openEditTrack = (track: Track) => {
    setEditingTrack(track);
    setTrackForm({
      title: track.title,
      description: track.description || "",
      category: track.category || "",
      estimated_hours: track.estimated_hours || 0,
      is_active: track.is_active ?? true,
      prerequisite_track_id: track.prerequisite_track_id || "",
    });
    setTrackDialogOpen(true);
  };

  const handleSaveTrack = async () => {
    if (!trackForm.title.trim()) { toast.error("Informe o título da trilha."); return; }

    if (editingTrack) {
      const { error } = await supabase.from("tracks").update({
        title: trackForm.title,
        description: trackForm.description || null,
        category: trackForm.category || null,
        estimated_hours: trackForm.estimated_hours,
        is_active: trackForm.is_active,
        prerequisite_track_id: trackForm.prerequisite_track_id || null,
      }).eq("id", editingTrack.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Trilha atualizada!");
    } else {
      const { error } = await supabase.from("tracks").insert({
        title: trackForm.title,
        description: trackForm.description || null,
        category: trackForm.category || null,
        estimated_hours: trackForm.estimated_hours,
        order_index: tracks.length + 1,
        is_active: trackForm.is_active,
        prerequisite_track_id: trackForm.prerequisite_track_id || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Trilha criada!");
    }
    setTrackDialogOpen(false);
    fetchTracks();
    fetchGlobalStats();
  };

  const handleToggleActive = async (track: Track) => {
    const newActive = !track.is_active;
    const { error } = await supabase.from("tracks").update({ is_active: newActive }).eq("id", track.id);
    if (error) toast.error(error.message);
    else {
      toast.success(newActive ? "Trilha ativada!" : "Trilha desativada.");
      fetchTracks();
      fetchGlobalStats();
    }
  };

  const handleDeleteTrack = async (id: string) => {
    const { error } = await supabase.from("tracks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Trilha excluída.");
      if (selectedTrackId === id) { setSelectedTrackId(null); setLessons([]); }
      fetchTracks();
      fetchGlobalStats();
    }
  };

  // ─── Lesson CRUD ───
  const openNewLesson = () => {
    setEditingLesson(null);
    setLessonForm({ title: "", description: "", video_url: "", duration: 0 });
    setLessonDialogOpen(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || "",
      video_url: lesson.video_url || "",
      duration: lesson.duration || 0,
    });
    setLessonDialogOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedTrackId || !lessonForm.title.trim()) { toast.error("Informe o título da aula."); return; }

    if (editingLesson) {
      const { error } = await supabase.from("lessons").update({
        title: lessonForm.title,
        description: lessonForm.description || null,
        video_url: lessonForm.video_url || null,
        duration: lessonForm.duration,
      }).eq("id", editingLesson.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Aula atualizada!");
    } else {
      const { error } = await supabase.from("lessons").insert({
        track_id: selectedTrackId,
        title: lessonForm.title,
        description: lessonForm.description || null,
        video_url: lessonForm.video_url || null,
        duration: lessonForm.duration,
        order_index: lessons.length + 1,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Aula adicionada!");
    }
    setLessonDialogOpen(false);
    fetchLessons(selectedTrackId);
    fetchTrackStats(tracks.map((t) => t.id));
    fetchGlobalStats();
  };

  const handleDeleteLesson = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Aula excluída.");
      if (selectedTrackId) fetchLessons(selectedTrackId);
      fetchTrackStats(tracks.map((t) => t.id));
      fetchGlobalStats();
    }
  };

  const handleMoveLessonOrder = async (lessonId: string, direction: "up" | "down") => {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;

    const a = lessons[idx];
    const b = lessons[swapIdx];
    await Promise.all([
      supabase.from("lessons").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("lessons").update({ order_index: a.order_index }).eq("id", b.id),
    ]);
    if (selectedTrackId) fetchLessons(selectedTrackId);
  };

  const completionRate = (trackId: string) => {
    const s = trackStats[trackId];
    if (!s || s.enrollmentCount === 0) return 0;
    return Math.round((s.completionCount / s.enrollmentCount) * 100);
  };

  // ─── Render ───
  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Gestão de Trilhas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crie, organize e gerencie trilhas de aprendizado</p>
        </div>
        <Button onClick={openNewTrack} className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Nova Trilha
        </Button>
      </div>

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total de Trilhas", value: globalStats.totalTracks, icon: Layers, color: "text-primary" },
          { label: "Trilhas Ativas", value: globalStats.activeTracks, icon: Eye, color: "text-success" },
          { label: "Total de Aulas", value: globalStats.totalLessons, icon: Video, color: "text-accent" },
          { label: "Matrículas", value: globalStats.totalEnrollments, icon: Users, color: "text-primary" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-surface p-4 flex items-start gap-3"
          >
            <div className={`rounded-lg bg-secondary p-2 ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar trilhas..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Track list - 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Trilhas <span className="text-muted-foreground font-normal">({filteredTracks.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="card-surface p-12 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="card-surface p-12 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma trilha encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredTracks.map((track) => {
                  const stats = trackStats[track.id] || { lessonCount: 0, enrollmentCount: 0, completionCount: 0 };
                  const rate = completionRate(track.id);
                  const isSelected = selectedTrackId === track.id;

                  return (
                    <motion.div
                      key={track.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`card-surface p-4 cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm hover:bg-secondary/20"
                      } ${!track.is_active ? "opacity-60" : ""}`}
                      onClick={() => setSelectedTrackId(track.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${track.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-foreground truncate">{track.title}</h4>
                              {track.is_active ? (
                                <Badge variant="outline" className="text-[10px] border-success/30 text-success bg-success/5">Ativa</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">Inativa</Badge>
                              )}
                            </div>
                            {track.category && (
                              <span className="text-[11px] text-muted-foreground">{track.category}</span>
                            )}
                            {track.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{track.description}</p>
                            )}

                            {/* Mini stats */}
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Video className="h-3 w-3" /> {stats.lessonCount} aulas
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" /> {stats.enrollmentCount} alunos
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {track.estimated_hours || 0}h
                              </span>
                              {stats.enrollmentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <BarChart3 className="h-3 w-3" /> {rate}% conclusão
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleActive(track)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                            title={track.is_active ? "Desativar" : "Ativar"}
                          >
                            {track.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => openEditTrack(track)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir trilha?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A trilha "{track.title}" e todas as suas aulas serão excluídas permanentemente. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTrack(track.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Completion bar */}
                      {stats.enrollmentCount > 0 && (
                        <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${rate}%` }} />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Lesson panel - 2 cols */}
        <div className="lg:col-span-2">
          {selectedTrack ? (
            <div className="card-surface p-0 overflow-hidden sticky top-4">
              {/* Track header */}
              <div className="bg-gradient-nexti p-4 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold truncate">{selectedTrack.title}</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openNewLesson}
                    className="gap-1 h-7 text-xs bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-0"
                  >
                    <Plus className="h-3 w-3" /> Aula
                  </Button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-primary-foreground/75">
                  <span>{lessons.length} aulas</span>
                  <span>·</span>
                  <span>{selectedTrack.estimated_hours || 0}h estimadas</span>
                </div>
              </div>

              {/* Lesson list */}
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {lessons.length === 0 ? (
                  <div className="p-8 text-center">
                    <Video className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada.</p>
                    <Button size="sm" variant="outline" onClick={openNewLesson} className="mt-3 gap-1">
                      <Plus className="h-3 w-3" /> Adicionar Aula
                    </Button>
                  </div>
                ) : (
                  lessons.map((lesson, i) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-secondary/20 transition-colors">
                      {/* Order controls */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMoveLessonOrder(lesson.id, "up")}
                          disabled={i === 0}
                          className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUpDown className="h-3 w-3 rotate-180" />
                        </button>
                      </div>

                      {/* Lesson number */}
                      <span className="tabular-nums text-xs font-bold text-muted-foreground w-5 text-center shrink-0">
                        {i + 1}
                      </span>

                      {/* Icon */}
                      <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                        <Video className="h-3.5 w-3.5 text-primary" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {lesson.duration ? `${Math.round(lesson.duration / 60)} min` : "—"}
                          </span>
                          {lesson.video_url && (
                            <a
                              href={lesson.video_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="h-2.5 w-2.5" /> vídeo
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditLesson(lesson)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A aula "{lesson.title}" será excluída permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLesson(lesson.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card-surface p-12 text-center sticky top-4">
              <ChevronRight className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Selecione uma trilha para gerenciar suas aulas</p>
            </div>
          )}
        </div>
      </div>

      {/* Track Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTrack ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
            <DialogDescription>
              {editingTrack ? "Atualize as informações da trilha." : "Preencha os dados para criar uma nova trilha de aprendizado."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={trackForm.title} onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} placeholder="Nome da trilha" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={trackForm.description} onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })} placeholder="Descreva a trilha..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={trackForm.category} onChange={(e) => setTrackForm({ ...trackForm, category: e.target.value })} placeholder="Ex: Gestão" />
              </div>
              <div className="space-y-2">
                <Label>Horas estimadas</Label>
                <Input type="number" value={trackForm.estimated_hours} onChange={(e) => setTrackForm({ ...trackForm, estimated_hours: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pré-requisito</Label>
              <Select value={trackForm.prerequisite_track_id || "none"} onValueChange={(v) => setTrackForm({ ...trackForm, prerequisite_track_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {tracks.filter((t) => t.id !== editingTrack?.id).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={trackForm.is_active} onCheckedChange={(v) => setTrackForm({ ...trackForm, is_active: v })} />
              <Label className="text-sm">Trilha ativa (visível para alunos)</Label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTrackDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTrack} className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-1">
              <Save className="h-4 w-4" /> {editingTrack ? "Salvar" : "Criar Trilha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
            <DialogDescription>
              {editingLesson ? "Atualize as informações da aula." : "Adicione uma nova aula à trilha selecionada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder="Título da aula" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} placeholder="Descrição da aula" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2 max-w-[200px]">
              <Label>Duração (segundos)</Label>
              <Input type="number" value={lessonForm.duration} onChange={(e) => setLessonForm({ ...lessonForm, duration: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLesson} className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-1">
              <Save className="h-4 w-4" /> {editingLesson ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTrilhasGestao;
