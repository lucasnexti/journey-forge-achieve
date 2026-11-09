// Course workload ("carga horária") is stored as decimal hours (tracks.estimated_hours)
// and typed/displayed as HH:MM.

/** Parses "H:MM"/"HH:MM" into decimal hours. Returns null when invalid. */
export function parseDurationHHMM(input: string): number | null {
  const m = input.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return Math.round((minutes / 60) * 10000) / 10000;
}

/** Decimal hours → "H:MM" for editing. */
export function hoursToHHMM(hours: number | null | undefined): string {
  const total = Math.round(Number(hours || 0) * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Decimal hours → "1h30min", "45min", "2h". */
export function formatDuration(hours: number | null | undefined): string {
  const total = Math.round(Number(hours || 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}min`;
  if (m) return `${m}min`;
  return `${h}h`;
}
