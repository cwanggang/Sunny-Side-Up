// A4.2 home geofence and A4.3 places visited, both computed ON THE PHONE.
// Coordinates never leave the phone: the geofence logs enter/exit times, and location updates
// are rounded to ~200 m cells kept in the local store (store.ts).
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { localDay } from './days';
import { updateStore } from './store';

export const HOME_TASK = 'sunny-home-geofence';
export const PLACES_TASK = 'sunny-places';
const HOME_RADIUS_M = 150;
/** 0.002° ≈ 220 m of latitude: two spots in the same cell count as one place. */
const CELL = 0.002;

const cellOf = (lat: number, lon: number) => `${Math.round(lat / CELL)}:${Math.round(lon / CELL)}`;

// ---------- background tasks (must be defined at module load, also on background launches) ----------

TaskManager.defineTask<{ eventType: Location.GeofencingEventType }>(HOME_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const type = data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
  await updateStore((s) => ({ ...s, homeEvents: [...s.homeEvents, { at: Date.now(), type }] }));
});

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(PLACES_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await updateStore((s) => {
    const cells = { ...s.cells };
    for (const loc of data.locations) {
      const day = localDay(new Date(loc.timestamp));
      const key = cellOf(loc.coords.latitude, loc.coords.longitude);
      const seen = new Set(cells[day] ?? []);
      seen.add(key);
      cells[day] = [...seen];
    }
    return { ...s, cells };
  });
});

// ---------- permissions ----------

export type PermissionState = 'granted' | 'denied' | 'undetermined';
const toState = (p: Location.LocationPermissionResponse): PermissionState =>
  p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

export async function locationPermissions(): Promise<{ foreground: PermissionState; background: PermissionState }> {
  const [fg, bg] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
  return { foreground: toState(fg), background: toState(bg) };
}

/** When-in-use first, then "Always" (iOS shows the upgrade prompt separately). */
export async function requestLocationPermissions(): Promise<{ foreground: PermissionState; background: PermissionState }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: toState(fg), background: 'undetermined' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: 'granted', background: toState(bg) };
}

// ---------- start / stop ----------

async function startHomeGeofence(home: { lat: number; lon: number }) {
  await Location.startGeofencingAsync(HOME_TASK, [
    { identifier: 'home', latitude: home.lat, longitude: home.lon, radius: HOME_RADIUS_M, notifyOnEnter: true, notifyOnExit: true },
  ]);
}

/** Starts whatever tracking the permissions allow. Safe to call repeatedly. */
export async function startLocationSignals(home: { lat: number; lon: number } | null): Promise<void> {
  const { background } = await locationPermissions();
  if (background !== 'granted') return;
  if (home && !(await Location.hasStartedGeofencingAsync(HOME_TASK))) await startHomeGeofence(home);
  if (!(await Location.hasStartedLocationUpdatesAsync(PLACES_TASK))) {
    await Location.startLocationUpdatesAsync(PLACES_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 200,
      deferredUpdatesInterval: 5 * 60 * 1000,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: false,
    });
  }
}

export async function stopLocationSignals(): Promise<void> {
  if (await Location.hasStartedGeofencingAsync(HOME_TASK).catch(() => false)) await Location.stopGeofencingAsync(HOME_TASK);
  if (await Location.hasStartedLocationUpdatesAsync(PLACES_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(PLACES_TASK);
  }
}

/** A4.2: "I'm home now". Saves home on the phone only and (re)starts the geofence. */
export async function setHomeHere(): Promise<void> {
  const { foreground } = await locationPermissions();
  if (foreground !== 'granted') throw new Error('Allow location first (Settings → Allow location).');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const home = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  await updateStore((s) => ({ ...s, home, homeEvents: [...s.homeEvents, { at: Date.now(), type: 'enter' }] }));
  if (await Location.hasStartedGeofencingAsync(HOME_TASK).catch(() => false)) await Location.stopGeofencingAsync(HOME_TASK);
  await startLocationSignals(home);
}
