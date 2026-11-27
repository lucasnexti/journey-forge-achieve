export const ADMIN_REPORT_TYPES = [
  { id: "td", label: "Indicadores de T&D", filters: ["period", "area", "training"] },
  { id: "progress", label: "Progresso dos cursos", filters: ["training"] },
  { id: "environments", label: "Visão consolidada dos ambientes", filters: ["period"], masterOnly: true },
] as const;
export type AdminReportType = typeof ADMIN_REPORT_TYPES[number]["id"];
export function resolveAdminReportType(value: string | null): AdminReportType {
  return ADMIN_REPORT_TYPES.find(type => type.id === value)?.id ?? "td";
}