// On-device daily-number pipeline + background tasks (A4.2–A4.5).
// Raw location/health data stays on the phone; only the daily_signals row is uploaded (plan.md §9).
// Importing this module defines the background tasks, so it must be imported at app start
// (src/api/signals.ts does, and real.ts imports that).
export { registerDailyTask, unregisterDailyTask, uploadIfDue, type DailyRow } from './daily';
export { healthAvailable, requestHealthAccess } from './health';
export {
  locationPermissions,
  requestLocationPermissions,
  setHomeHere,
  startLocationSignals,
  stopLocationSignals,
  type PermissionState,
} from './location';
export { clearAll, clearLocationData, readStore } from './store';
