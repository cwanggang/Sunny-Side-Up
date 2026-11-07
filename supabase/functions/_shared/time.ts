// Local-time helpers. Everything the scheduler does is "at the right hour in the
// recipient's own timezone", so all date math goes through here.

export interface LocalTime {
  date: string; // YYYY-MM-DD in that timezone
  hour: number; // 0-23
  weekday: number; // 0 = Sunday
  isoWeek: string; // e.g. 2026-W45
}

const FALLBACK_TZ = 'America/New_York';

export function localTime(now: Date, timeZone: string | null | undefined): LocalTime {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || FALLBACK_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now);
  } catch {
    return localTime(now, FALLBACK_TZ);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { date, hour: Number(get('hour')), weekday, isoWeek: isoWeekKey(date) };
}

/** YYYY-MM-DD + n days (pure calendar math, no timezone). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week key for a calendar date, e.g. '2026-W45'. */
export function isoWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Does a birthday (any year) fall on this calendar date? Feb 29 birthdays count on Feb 28 in non-leap years. */
export function isBirthdayOn(birthday: string, date: string): boolean {
  const [, bm, bd] = birthday.split('-');
  const [y, m, d] = date.split('-');
  if (bm === '02' && bd === '29' && !isLeap(Number(y))) return m === '02' && d === '28';
  return bm === m && bd === d;
}
