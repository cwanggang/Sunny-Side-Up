// A4.4 HealthKit (only when ENABLE_HEALTHKIT is on): last night's sleep hours and a day's steps.
// Read-only. Only these two numbers ever leave the phone (plan §9.2).
import {
  CategoryValueSleepAnalysis,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { addHours, startOfDay } from './days';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;

const ASLEEP = new Set<number>([
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

export function healthAvailable(): boolean {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Shows Apple's Health sheet (sleep + steps, read only). Apple never says whether read access was granted. */
export async function requestHealthAccess(): Promise<void> {
  if (!healthAvailable()) return;
  await requestAuthorization({ toRead: [SLEEP, STEPS] });
}

/**
 * Hours asleep in the night leading into `day`: 18:00 the evening before → 12:00 on `day`.
 * Overlapping samples (iPhone + Watch) are merged so nothing is counted twice.
 */
export async function sleepHoursFor(day: string): Promise<number | null> {
  const start = addHours(startOfDay(day), -6);
  const end = addHours(startOfDay(day), 12);
  const samples = await queryCategorySamples(SLEEP, {
    limit: 0,
    filter: { date: { startDate: start, endDate: end } },
  });
  const spans = samples
    .filter((s) => ASLEEP.has(s.value as number))
    .map((s) => [Math.max(+s.startDate, +start), Math.min(+s.endDate, +end)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  if (spans.length === 0) return null;
  let total = 0;
  let [curStart, curEnd] = spans[0];
  for (const [a, b] of spans.slice(1)) {
    if (a <= curEnd) curEnd = Math.max(curEnd, b);
    else {
      total += curEnd - curStart;
      [curStart, curEnd] = [a, b];
    }
  }
  total += curEnd - curStart;
  return Math.round((total / 3_600_000) * 10) / 10;
}

/** Steps taken on `day` (local midnight to midnight). HealthKit's own sum de-duplicates sources. */
export async function stepsFor(day: string): Promise<number | null> {
  const start = startOfDay(day);
  const result = await queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
    filter: { date: { startDate: start, endDate: addHours(start, 24) } },
    unit: 'count',
  });
  const steps = result.sumQuantity?.quantity;
  return steps === undefined ? null : Math.round(steps);
}
