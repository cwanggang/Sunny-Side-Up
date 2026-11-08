// Calendar dates in the phone's own time zone (matches how the server's scheduler keys
// Sunday shares and spotlight days in each user's timezone).

/** Today (or `at`) as YYYY-MM-DD in the phone's time zone. */
export function localDate(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD + n days (pure calendar math). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 0 = Sunday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * ISO-8601 week key, e.g. '2026-W45'. Same algorithm as the server (supabase/functions/_shared/time.ts).
 * ISO weeks run Monday–Sunday, so a week's key is also the key of the Sunday that ends it.
 */
export function isoWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Next date (today or later) a birthday falls on. Feb 29 counts as Feb 28 in non-leap years. */
export function nextBirthday(birthday: string, today: string): string {
  const [, bm, bd] = birthday.split('-');
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const day = bm === '02' && bd === '29' && !isLeap(y) ? '28' : bd;
    const candidate = `${y}-${bm}-${day}`;
    if (candidate >= today) return candidate;
  }
  return `${year + 1}-${bm}-${bd}`;
}
