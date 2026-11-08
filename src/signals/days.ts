// Local calendar days for the signal pipeline (phone's time zone).

export function localDay(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** Local midnight at the start of `day` (YYYY-MM-DD). */
export function startOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDay(d);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}
