// A4.5: once a day, compute yesterday's summary row ON THE PHONE and upsert it into
// `daily_signals`. Runs from a background task and, as a fallback, when the app opens.
// Consent gates every field (plan §9.6): a signal the user didn't allow is never collected or sent.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { getSupabase } from '@/api/client';
import { HEALTHKIT_ENABLED } from '@/api/config';

import { addHours, startOfDay, yesterday } from './days';
import { sleepHoursFor, stepsFor } from './health';
import { locationPermissions } from './location';
import { readStore, updateStore, type HomeEvent } from './store';

export const DAILY_TASK = 'sunny-daily-signals';

export interface DailyRow {
  day: string;
  hours_away_from_home: number | null;
  places_visited: number | null;
  sleep_hours: number | null;
  steps: number | null;
}

/** Hours spent away from home on `day`, from the geofence's enter/exit log. */
export function hoursAway(events: HomeEvent[], day: string, now = Date.now()): number {
  const dayStart = +startOfDay(day);
  const dayEnd = Math.min(+addHours(startOfDay(day), 24), now);
  const sorted = [...events].sort((a, b) => a.at - b.at);
  // State when the day began: the last event before it (no events at all = assume home).
  let away = sorted.filter((e) => e.at < dayStart).at(-1)?.type === 'exit';
  let since = dayStart;
  let total = 0;
  for (const e of sorted.filter((x) => x.at >= dayStart && x.at < dayEnd)) {
    if (away) total += e.at - since;
    away = e.type === 'exit';
    since = e.at;
  }
  if (away) total += dayEnd - since;
  return Math.round((total / 3_600_000) * 10) / 10;
}

export async function computeRow(day: string, allowed: { location: boolean; health: boolean }): Promise<DailyRow> {
  const store = await readStore();
  const tracking = allowed.location && (await locationPermissions()).background === 'granted';
  const row: DailyRow = { day, hours_away_from_home: null, places_visited: null, sleep_hours: null, steps: null };
  if (tracking) {
    row.hours_away_from_home = store.home ? hoursAway(store.homeEvents, day) : null;
    row.places_visited = store.cells[day]?.length ?? 0;
  }
  if (allowed.health && HEALTHKIT_ENABLED) {
    row.sleep_hours = await sleepHoursFor(day).catch(() => null);
    row.steps = await stepsFor(day).catch(() => null);
  }
  return row;
}

/**
 * Uploads yesterday's row if it hasn't been uploaded yet. Returns what was sent (or null).
 * `force` re-sends even if already done today (used by the settings screen for testing).
 */
export async function uploadIfDue(force = false): Promise<DailyRow | null> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return null;

  const day = yesterday();
  const store = await readStore();
  if (!force && store.lastUploadDay === day) return null;

  const { data: consent, error } = await supabase
    .from('consents')
    .select('location, health')
    .eq('user_id', userId)
    .single();
  if (error || !consent) return null;
  if (!consent.location && !consent.health) return null;

  const row = await computeRow(day, { location: consent.location, health: consent.health });
  const nothing = Object.entries(row).every(([k, v]) => k === 'day' || v === null);
  if (!nothing) {
    const { error: upErr } = await supabase
      .from('daily_signals')
      .upsert({ user_id: userId, ...row, uploaded_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
    if (upErr) throw new Error(upErr.message);
  }
  await updateStore((s) => ({ ...s, lastUploadDay: day }));
  return nothing ? null : row;
}

// ---------- background task ----------

TaskManager.defineTask(DAILY_TASK, async () => {
  try {
    await uploadIfDue();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the daily background upload (iOS decides the exact time; at most every ~12 h). */
export async function registerDailyTask(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(DAILY_TASK)) return;
  await BackgroundTask.registerTaskAsync(DAILY_TASK, { minimumInterval: 12 * 60 });
}

export async function unregisterDailyTask(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(DAILY_TASK)) await BackgroundTask.unregisterTaskAsync(DAILY_TASK);
}
