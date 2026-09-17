/**
 * Shared date and duration formatting.
 *
 * Both history views had their own copy, and the list version assumed
 * `ended_at` and `duration_seconds` were always set. They are null while a
 * session is live, so the list rendered "Invalid Date" and "NaNm NaNs".
 */

export function formatRunDate(value: string | null | undefined): string {
  if (!value) return "Pågår";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukjent tidspunkt";
  return date.toLocaleString("nb-NO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "Pågår";
  }
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sek`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} t ${minutes} min`;
  return `${minutes} min`;
}
