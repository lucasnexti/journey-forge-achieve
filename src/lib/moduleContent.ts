/** Null belongs only to legacy, ungrouped content; never to every module. */
export function contentForModule<T extends { module_id?: string | null }>(items: T[], moduleId: string | null): T[] {
  return items.filter((item) => (item.module_id ?? null) === moduleId);
}