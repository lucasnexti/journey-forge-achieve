/** Null belongs only to legacy, ungrouped content; never to every module. */
export function contentForModule<T extends { module_id?: string | null }>(items: T[], moduleId: string | null): T[] {
  return items.filter((item) => (item.module_id ?? null) === moduleId);
}
/**
 * Sequência dos módulos: um módulo só libera depois que todos os anteriores
 * tiverem as aulas concluídas e (se houver) a prova do módulo aprovada.
 */
export function lockedModuleIds(
  mods: { id: string }[],
  lessons: { id: string; module_id?: string | null }[],
  examModuleIds: string[],
  passedModuleIds: string[],
  isComplete: (lessonId: string) => boolean,
): Set<string> {
  const locked = new Set<string>();
  let blocked = false;
  for (const m of mods) {
    if (blocked) { locked.add(m.id); continue; }
    const ls = contentForModule(lessons, m.id);
    const videosDone = ls.every((l) => isComplete(l.id));
    const examOk = !examModuleIds.includes(m.id) || passedModuleIds.includes(m.id);
    if (!videosDone || !examOk) blocked = true;
  }
  return locked;
}
