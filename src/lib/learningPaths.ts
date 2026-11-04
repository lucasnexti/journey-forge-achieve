import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface PathCourse { track_id: string; category: string; position: number; title?: string; description?: string; cover_image_url?: string; completed?: boolean; started?: boolean; unlocked?: boolean }
export interface LearningPath { id: string; name: string; description: string; cover_path: string | null; status: string; progression: string; categories: string[]; courses: PathCourse[]; coverUrl?: string }
export interface PathStudent { user_id: string; name: string; email: string; companies: { id: string; name: string }[]; completed_courses: string[]; started: boolean }
export const pathStatus = { draft: 'Rascunho', published: 'Publicada', archived: 'Arquivada' };
export function pathProgress(courses: { completed?: boolean; started?: boolean }[]) {
  const completed = courses.filter(c => c.completed).length;
  return { percent: courses.length ? Math.round(completed * 100 / courses.length) : 0, status: courses.length && completed === courses.length ? 'Concluída' : completed || courses.some(c => c.started) ? 'Em andamento' : 'Não iniciada' };
}
export function validatePath(data: { name: string; description: string; status: string; categories: string[]; courses: PathCourse[] }) {
  const errors: Record<string,string> = {};
  if (!data.name.trim()) errors.name = 'Informe o nome da trilha.';
  if (!data.description.trim()) errors.description = 'Informe a descrição da trilha.';
  if (data.status === 'published' && !data.courses.length) errors.courses = 'Adicione pelo menos um curso antes de publicar.';
  if (new Set(data.courses.map(c => c.track_id)).size !== data.courses.length) errors.courses = 'Não repita um curso na mesma trilha.';
  if (data.categories.some(c => !c.trim()) || new Set(data.categories).size !== data.categories.length) errors.categories = 'Use nomes de categorias únicos e não vazios.';
  return errors;
}
export function sequentialUnlocked(courses: PathCourse[], index: number) { return courses.slice(0,index).every(c => c.completed); }
export function filterPathStudents(students: PathStudent[], courses: PathCourse[], search: string, company: string, status: string) {
  return students.map(s => ({ ...s, ...pathProgress(courses.map(c => ({ completed: s.completed_courses.includes(c.track_id), started: s.started }))) })).filter(s =>
    `${s.name} ${s.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (company === 'all' || s.companies.some(c => c.id === company)) && (status === 'all' || s.status === status));
}
export function csvCell(value: unknown) { const s = String(value ?? ''); return `"${/^[=+@\-\t\r]/.test(s) ? "'" : ''}${s.replaceAll('"','""')}"`; }
export function studentsCsv(students: ReturnType<typeof filterPathStudents>) { return '\uFEFF' + ['Nome;Empresa;Progresso;Situação', ...students.map(s => [s.name,s.companies.map(c => c.name).join(', '),`${s.percent}%`,s.status].map(csvCell).join(';'))].join('\r\n'); }
export function validatePathCover(file: Pick<File,'type'|'size'>) { return !['image/jpeg','image/png','image/webp'].includes(file.type) ? 'Use uma imagem JPG, PNG ou WEBP.' : file.size <= 0 || file.size > 5*1024*1024 ? 'A imagem deve ter até 5 MB e não pode estar vazia.' : null; }
export async function coverUrl(path: string | null) { if (!path) return undefined; const { data, error } = await supabase.storage.from('learning-path-covers').createSignedUrl(path,600); if (error) throw error; return data.signedUrl; }
export async function pathSnapshot(id: string): Promise<LearningPath> { const {data,error} = await supabase.rpc('learning_path_snapshot',{_path:id}); if(error) throw error; const p = data as unknown as LearningPath; return {...p,coverUrl:await coverUrl(p.cover_path)}; }
export async function listPaths(admin = false): Promise<LearningPath[]> {
  const {data,error} = await supabase.from('learning_paths').select('*,learning_path_courses(*)').order('created_at',{ascending:false});
  if(error) throw error;
  if(!admin) return Promise.all((data || []).map(p => pathSnapshot(p.id)));
  return Promise.all((data || []).map(async p => ({...p,categories:p.categories as string[],courses:p.learning_path_courses.sort((a,b) => a.position-b.position),coverUrl:await coverUrl(p.cover_path)})));
}
export async function savePath(id: string | null, data: Omit<LearningPath,'id'|'coverUrl'>) {
  const {data:result,error} = await supabase.rpc('save_learning_path',{_id:id as unknown as string,_data:data as unknown as Json}); if(error) throw error; return result;
}
export async function pathReport(id: string): Promise<PathStudent[]> { const {data,error} = await supabase.rpc('learning_path_report',{_path:id}); if(error) throw error; return data as unknown as PathStudent[]; }