/**
 * Formats a Date using its LOCAL year/month/day (not getUTC*), so a date
 * picked in the picker always round-trips to the same calendar day here
 * and back -- using UTC components would shift the day by one for anyone
 * west of UTC, the same class of bug the web app's own due-date rendering
 * deliberately avoids.
 */
export function dateToIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a "YYYY-MM-DD" string into a local-time Date (midnight local),
 * for the same reason -- `new Date("YYYY-MM-DD")` parses as UTC midnight,
 * which displays as the day before in western timezones. */
export function isoDateStringToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}
