/** The local calendar day as YYYY-MM-DD (not UTC: 7am in Bengaluru is still "today"). */
export function localDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", or "never". */
export function lastWornLabel(iso: string | null, today: string = localDay()): string {
  if (!iso) return "Never worn";
  const days = Math.round((Date.parse(today) - Date.parse(localDay(new Date(iso)))) / 86_400_000);
  if (days <= 0) return "Worn today";
  if (days === 1) return "Worn yesterday";
  if (days < 14) return `Worn ${days} days ago`;
  return `Worn ${Math.floor(days / 7)} weeks ago`;
}
