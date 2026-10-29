import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Video, FileText, Link2, ArrowUp, ArrowDown, ExternalLink, Save, Upload,
  FileSpreadsheet, Presentation, File as FileIcon, EyeOff,
} from "lucide-react";
import {
  MATERIAL_ACCEPT, MATERIAL_BUCKET, fileExt, getMaterialLink, uploadWithProgress, validateMaterialFile,
} from "@/lib/courseMaterials";

interface Module { id: string; track_id: string; title: string; description: string | null; order_index: number }
interface Lesson {
  id: string; track_id: string; module_id: string | null; title: string; description: string | null;
  video_url: string | null; duration: number | null; order_index: number | null; is_published: boolean;
}
interface Material {
  id: string; module_id: string; lesson_id: string | null; title: string; description: string | null;
  kind: string; file_path: string | null; file_name: string | null; external_url: string | null; order_index: number;
}

const fetchVimeoDuration = async (url: string): Promise<number | null> => {
  const m = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  try {
    const clean = m[2] ? `https://vimeo.com/${m[1]}/${m[2]}` : `https://vimeo.com/${m[1]}`;
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(clean)}`);
    return r.ok ? (await r.json()).duration || null : null;
  } catch { return null; }
};

export const materialIcon = (m: { kind: string; file_name: string | null }) => {
  if (m.kind === "link") return Link2;
  const ext = fileExt(m.file_name || "");
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["ppt", "pptx"].includes(ext)) return Presentation;
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return FileText;
  return FileIcon;
};

const emptyLesson = { title: "", description: "", video_url: "", duration: 0, is_published: true };
const emptyMaterial = { title: "", description: "", kind: "file" as "file" | "link", external_url: "", lesson_id: "" };

export default function CourseContentEditor({ trackId, onChanged }: { trackId: string; onChanged?: () => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string[]>([]);

  const [modDialog, setModDialog] = useState<{ open: boolean; editing: Module | null; title: string; description: string }>({ open: false, editing: null, title: "", description: "" });
  const [lesDialog, setLesDialog] = useState<{ open: boolean; moduleId: string; editing: Lesson | null; form: typeof emptyLesson }>({ open: false, moduleId: "", editing: null, form: emptyLesson });
  const [matDialog, setMatDialog] = useState<{ open: boolean; moduleId: string; editing: Material | null; form: typeof emptyMaterial; file: File | null; progress: number | null }>({ open: false, moduleId: "", editing: null, form: emptyMaterial, file: null, progress: null });

  const load = useCallback(async () => {
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from("course_modules").select("*").eq("track_id", trackId).order("order_index"),
      supabase.from("lessons").select("*").eq("track_id", trackId).order("order_index"),
    ]);
    const mods = (m || []) as Module[];
    setModules(mods);
    setLessons((l || []) as Lesson[]);
    if (mods.length) {
      const { data: mat } = await supabase.from("module_materials").select("*").in("module_id", mods.map((x) => x.id)).order("order_index");
      setMaterials((mat || []) as Material[]);
    } else setMaterials([]);
  }, [trackId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<{ error: any } | void>, ok: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await fn();
      if (r && r.error) { toast.error(r.error.message); return false; }
      toast.success(ok);
      await load();
      onChanged?.();
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Algo deu errado.");
      return false;
    } finally { setBusy(false); }
  };

  // ── Modules ──
  const saveModule = async () => {
    const title = modDialog.title.trim();
    if (!title) return toast.error("Informe o título do módulo.");
    const ok = await run(async () => modDialog.editing
      ? supabase.from("course_modules").update({ title, description: modDialog.description || null }).eq("id", modDialog.editing.id)
      : supabase.from("course_modules").insert({ track_id: trackId, title, description: modDialog.description || null, order_index: (modules.at(-1)?.order_index ?? 0) + 1 }),
      modDialog.editing ? "Módulo atualizado." : "Módulo criado.");
    if (ok) setModDialog((d) => ({ ...d, open: false }));
  };

  const deleteModule = (mod: Module) => run(async () => {
    // Lessons are kept (moved out of the module) so student progress is never lost.
    const n = lessons.filter((l) => l.module_id === mod.id).length;
    if (n > 0) return { error: { message: "Mova ou exclua as aulas deste módulo antes de excluí-lo." } };
    return supabase.from("course_modules").delete().eq("id", mod.id);
  }, "Módulo excluído.");

  const swap = async (table: "course_modules" | "lessons" | "module_materials", list: { id: string; order_index: number | null }[], idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    await run(async () => {
      // Re-number the whole list so equal/null order values never get stuck.
      const reordered = [...list];
      [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
      const results = await Promise.all(reordered.map((it, i) => supabase.from(table).update({ order_index: i + 1 }).eq("id", it.id)));
      return results.find((r) => r.error) || { error: null };
    }, "Ordem atualizada.");
  };

  // ── Lessons ──
  const openLesson = (moduleId: string, l?: Lesson) => setLesDialog({
    open: true, moduleId, editing: l || null,
    form: l ? { title: l.title, description: l.description || "", video_url: l.video_url || "", duration: l.duration || 0, is_published: l.is_published } : emptyLesson,
  });

  const onVideoUrl = async (url: string) => {
    setLesDialog((d) => ({ ...d, form: { ...d.form, video_url: url } }));
    const dur = await fetchVimeoDuration(url);
    if (dur) setLesDialog((d) => ({ ...d, form: { ...d.form, duration: dur } }));
  };

  const saveLesson = async () => {
    const f = lesDialog.form;
    if (!f.title.trim()) return toast.error("Informe o título da aula.");
    if (f.video_url && !/^https:\/\//i.test(f.video_url)) return toast.error("O link do vídeo deve começar com https://");
    const payload = { title: f.title.trim(), description: f.description || null, video_url: f.video_url || null, duration: f.duration || 0, is_published: f.is_published };
    const inModule = lessons.filter((l) => l.module_id === lesDialog.moduleId);
    const maxOrder = Math.max(0, ...lessons.map((l) => l.order_index || 0));
    const ok = await run(async () => lesDialog.editing
      ? supabase.from("lessons").update(payload).eq("id", lesDialog.editing.id)
      : supabase.from("lessons").insert({ ...payload, track_id: trackId, module_id: lesDialog.moduleId, order_index: maxOrder + 1 + inModule.length * 0 }),
      lesDialog.editing ? "Aula atualizada." : "Aula adicionada.");
    if (ok) setLesDialog((d) => ({ ...d, open: false }));
  };

  const moveLessonToModule = (l: Lesson, moduleId: string) =>
    run(async () => supabase.from("lessons").update({ module_id: moduleId }).eq("id", l.id), "Aula movida.");

  const deleteLesson = (l: Lesson) => run(async () => supabase.from("lessons").delete().eq("id", l.id), "Aula excluída.");

  // ── Materials ──
  const openMaterial = (moduleId: string, m?: Material) => setMatDialog({
    open: true, moduleId, editing: m || null, file: null, progress: null,
    form: m ? { title: m.title, description: m.description || "", kind: m.kind as any, external_url: m.external_url || "", lesson_id: m.lesson_id || "" } : emptyMaterial,
  });

  const pickFile = (file: File | null) => {
    if (!file) return;
    const err = validateMaterialFile(file);
    if (err) return toast.error(err);
    setMatDialog((d) => ({ ...d, file, form: { ...d.form, title: d.form.title || file.name.replace(/\.[^.]+$/, "") } }));
  };

  const saveMaterial = async () => {
    if (busy) return;
    const { form, file, editing, moduleId } = matDialog;
    if (!form.title.trim()) return toast.error("Informe o título do material.");
    if (form.kind === "link" && !/^https:\/\//i.test(form.external_url)) return toast.error("Informe um link começando com https://");
    if (form.kind === "file" && !file && !editing?.file_path) return toast.error("Selecione um arquivo.");

    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      let fileFields: Record<string, any> = {};
      if (form.kind === "file" && file) {
        uploadedPath = `${trackId}/${moduleId}/${crypto.randomUUID()}.${fileExt(file.name)}`;
        setMatDialog((d) => ({ ...d, progress: 0 }));
        await uploadWithProgress(MATERIAL_BUCKET, uploadedPath, file, (p) => setMatDialog((d) => ({ ...d, progress: p })));
        fileFields = { file_path: uploadedPath, file_name: file.name, file_size: file.size, mime_type: file.type || null, external_url: null };
      }
      if (form.kind === "link") fileFields = { external_url: form.external_url, file_path: null, file_name: null, file_size: null, mime_type: null };
      const payload = { title: form.title.trim(), description: form.description || null, kind: form.kind, lesson_id: form.lesson_id || null, ...fileFields };
      const { error } = editing
        ? await supabase.from("module_materials").update(payload).eq("id", editing.id)
        : await supabase.from("module_materials").insert({ ...payload, module_id: moduleId, order_index: materials.filter((m) => m.module_id === moduleId).length + 1 });
      if (error) throw error;
      // Replaced or switched to link: remove the old file.
      if (editing?.file_path && (uploadedPath || form.kind === "link")) await supabase.storage.from(MATERIAL_BUCKET).remove([editing.file_path]);
      toast.success(editing ? "Material atualizado." : "Material adicionado.");
      setMatDialog((d) => ({ ...d, open: false }));
      await load();
    } catch (e: any) {
      if (uploadedPath) await supabase.storage.from(MATERIAL_BUCKET).remove([uploadedPath]);
      toast.error(e?.message || "Não foi possível salvar o material.");
      setMatDialog((d) => ({ ...d, progress: null }));
    } finally { setBusy(false); }
  };

  const deleteMaterial = (m: Material) => run(async () => {
    const r = await supabase.from("module_materials").delete().eq("id", m.id);
    if (!r.error && m.file_path) await supabase.storage.from(MATERIAL_BUCKET).remove([m.file_path]);
    return r;
  }, "Material removido.");

  const openMaterialLink = async (m: Material) => {
    try {
      window.open(m.kind === "link" ? m.external_url! : await getMaterialLink(m.file_path!), "_blank", "noopener");
    } catch { toast.error("Não foi possível abrir o arquivo."); }
  };

  const orphanLessons = lessons.filter((l) => !l.module_id || !modules.some((m) => m.id === l.module_id));

  return (
    <div className="card-surface p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Módulos e aulas</h3>
          <p className="text-[11px] text-muted-foreground">{modules.length} módulos · {lessons.length} aulas · {materials.length} materiais</p>
        </div>
        <Button size="sm" onClick={() => setModDialog({ open: true, editing: null, title: "", description: "" })} className="gap-1 bg-gradient-nexti text-primary-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Módulo
        </Button>
      </div>

      {modules.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhum módulo ainda. Comece criando o primeiro módulo.</div>
      ) : (
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="divide-y divide-border">
          {modules.map((mod, mi) => {
            const modLessons = lessons.filter((l) => l.module_id === mod.id);
            const modMats = materials.filter((m) => m.module_id === mod.id);
            return (
              <AccordionItem key={mod.id} value={mod.id} className="border-0">
                <div className="flex items-center gap-1 pr-3">
                  <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline">
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">Módulo {mi + 1} — {mod.title}</p>
                      <p className="text-[11px] text-muted-foreground font-normal">{modLessons.length} aulas · {modMats.length} materiais</p>
                    </div>
                  </AccordionTrigger>
                  <button aria-label="Subir módulo" disabled={mi === 0 || busy} onClick={() => swap("course_modules", modules, mi, -1)} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="Descer módulo" disabled={mi === modules.length - 1 || busy} onClick={() => swap("course_modules", modules, mi, 1)} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button aria-label="Editar módulo" onClick={() => setModDialog({ open: true, editing: mod, title: mod.title, description: mod.description || "" })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button aria-label="Excluir módulo" className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir módulo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O módulo "{mod.title}" e seus materiais serão excluídos. Só é possível excluir módulos sem aulas, para não apagar o progresso dos alunos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteModule(mod)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <AccordionContent className="px-4 pb-4">
                  {mod.description && <p className="mb-3 text-xs text-muted-foreground">{mod.description}</p>}

                  <div className="space-y-1.5">
                    {modLessons.map((l, li) => (
                      <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                        <Video className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground">{l.duration ? `${Math.round(l.duration / 60)} min` : "Sem duração"}</p>
                        </div>
                        {!l.is_published && <Badge variant="outline" className="gap-1 text-[10px]"><EyeOff className="h-3 w-3" />Rascunho</Badge>}
                        {l.video_url && <a href={l.video_url} target="_blank" rel="noreferrer" aria-label="Ver vídeo" className="p-1 text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        <button aria-label="Subir aula" disabled={li === 0 || busy} onClick={() => swap("lessons", modLessons, li, -1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button aria-label="Descer aula" disabled={li === modLessons.length - 1 || busy} onClick={() => swap("lessons", modLessons, li, 1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button aria-label="Editar aula" onClick={() => openLesson(mod.id, l)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button aria-label="Excluir aula" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
                              <AlertDialogDescription>A aula "{l.title}" e o progresso dos alunos nela serão apagados. Para só esconder, marque a aula como rascunho.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteLesson(l)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                    {modMats.map((m, i) => {
                      const Icon = materialIcon(m);
                      return (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
                          <Icon className="h-4 w-4 shrink-0 text-accent" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{m.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{m.kind === "link" ? "Link externo" : m.file_name}</p>
                          </div>
                          <button aria-label="Abrir material" onClick={() => openMaterialLink(m)} className="p-1 text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></button>
                          <button aria-label="Subir material" disabled={i === 0 || busy} onClick={() => swap("module_materials", modMats, i, -1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button aria-label="Descer material" disabled={i === modMats.length - 1 || busy} onClick={() => swap("module_materials", modMats, i, 1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button aria-label="Editar material" onClick={() => openMaterial(mod.id, m)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><button aria-label="Excluir material" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover material?</AlertDialogTitle>
                                <AlertDialogDescription>"{m.title}" será removido e o arquivo apagado.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMaterial(m)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openLesson(mod.id)}><Video className="h-3.5 w-3.5" /> Adicionar vídeo</Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openMaterial(mod.id)}><FileText className="h-3.5 w-3.5" /> Adicionar material</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {orphanLessons.length > 0 && modules.length > 0 && (
        <div className="border-t border-border p-4">
          <p className="mb-2 text-xs font-semibold text-foreground">Aulas sem módulo</p>
          {orphanLessons.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span className="truncate">{l.title}</span>
              <select className="rounded-md border border-input bg-background px-2 py-1 text-xs" defaultValue="" onChange={(e) => e.target.value && moveLessonToModule(l, e.target.value)}>
                <option value="">Mover para…</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Module dialog */}
      <Dialog open={modDialog.open} onOpenChange={(o) => setModDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modDialog.editing ? "Editar módulo" : "Novo módulo"}</DialogTitle>
            <DialogDescription>Ex.: "Boas-vindas à Nexti".</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Título *</Label><Input value={modDialog.title} onChange={(e) => setModDialog((d) => ({ ...d, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={modDialog.description} onChange={(e) => setModDialog((d) => ({ ...d, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button disabled={busy} onClick={saveModule} className="gap-1 bg-gradient-nexti text-primary-foreground"><Save className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lesDialog.open} onOpenChange={(o) => setLesDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lesDialog.editing ? "Editar aula" : "Nova aula em vídeo"}</DialogTitle>
            <DialogDescription>Cole o link do vídeo hospedado na JMV Stream ou no Vimeo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Título *</Label><Input value={lesDialog.form.title} onChange={(e) => setLesDialog((d) => ({ ...d, form: { ...d.form, title: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={lesDialog.form.description} onChange={(e) => setLesDialog((d) => ({ ...d, form: { ...d.form, description: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Link do vídeo</Label><Input placeholder="https://player.jmvstream.com/..." value={lesDialog.form.video_url} onChange={(e) => onVideoUrl(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Duração (minutos)</Label>
              <Input type="number" min={0} className="max-w-[140px]" value={Math.round((lesDialog.form.duration || 0) / 60)}
                onChange={(e) => setLesDialog((d) => ({ ...d, form: { ...d.form, duration: Math.max(0, Number(e.target.value)) * 60 } }))} />
              <p className="text-[11px] text-muted-foreground">Preenchida sozinha para vídeos do Vimeo. Usada para marcar a aula como concluída aos 90%.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={lesDialog.form.is_published} onCheckedChange={(v) => setLesDialog((d) => ({ ...d, form: { ...d.form, is_published: v } }))} />
              <Label>{lesDialog.form.is_published ? "Publicada" : "Rascunho (alunos não veem)"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLesDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button disabled={busy} onClick={saveLesson} className="gap-1 bg-gradient-nexti text-primary-foreground"><Save className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material dialog */}
      <Dialog open={matDialog.open} onOpenChange={(o) => !busy && setMatDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{matDialog.editing ? "Editar material" : "Novo material"}</DialogTitle>
            <DialogDescription>PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT ou CSV até 50 MB, ou um link externo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["file", "link"] as const).map((k) => (
                <Button key={k} type="button" size="sm" variant={matDialog.form.kind === k ? "default" : "outline"} onClick={() => setMatDialog((d) => ({ ...d, form: { ...d.form, kind: k } }))}>
                  {k === "file" ? "Arquivo" : "Link externo"}
                </Button>
              ))}
            </div>
            {matDialog.form.kind === "file" ? (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border p-5 text-center text-sm text-muted-foreground hover:border-primary"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0] || null); }}>
                <Upload className="h-5 w-5" />
                {matDialog.file ? matDialog.file.name : matDialog.editing?.file_name ? `Atual: ${matDialog.editing.file_name} — clique para trocar` : "Arraste um arquivo aqui ou clique para selecionar"}
                <input type="file" accept={MATERIAL_ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
              </label>
            ) : (
              <div className="space-y-1.5"><Label>Link *</Label><Input placeholder="https://..." value={matDialog.form.external_url} onChange={(e) => setMatDialog((d) => ({ ...d, form: { ...d.form, external_url: e.target.value } }))} /></div>
            )}
            {matDialog.progress !== null && (
              <div className="space-y-1"><Progress value={matDialog.progress} /><p className="text-[11px] text-muted-foreground">Enviando… {matDialog.progress}%</p></div>
            )}
            <div className="space-y-1.5"><Label>Título *</Label><Input value={matDialog.form.title} onChange={(e) => setMatDialog((d) => ({ ...d, form: { ...d.form, title: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={matDialog.form.description} onChange={(e) => setMatDialog((d) => ({ ...d, form: { ...d.form, description: e.target.value } }))} /></div>
            <div className="space-y-1.5">
              <Label>Vincular a uma aula (opcional)</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={matDialog.form.lesson_id}
                onChange={(e) => setMatDialog((d) => ({ ...d, form: { ...d.form, lesson_id: e.target.value } }))}>
                <option value="">Material do módulo inteiro</option>
                {lessons.filter((l) => l.module_id === matDialog.moduleId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setMatDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button disabled={busy} onClick={saveMaterial} className="gap-1 bg-gradient-nexti text-primary-foreground"><Save className="h-4 w-4" /> {busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
