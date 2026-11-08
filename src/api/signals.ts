// A4.1 permissions, A4.2 set home, A4.5 daily upload wiring, and keeping on-phone collection in
// step with consent (plan §9.6): if a signal is switched off, the phone stops collecting it and
// forgets what it had.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  clearAll,
  clearLocationData,
  locationPermissions,
  readStore,
  registerDailyTask,
  requestHealthAccess,
  requestLocationPermissions,
  setHomeHere,
  startLocationSignals,
  stopLocationSignals,
  unregisterDailyTask,
  uploadIfDue,
} from '@/signals';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { HEALTHKIT_ENABLED } from './config';
import { unwrap } from './errors';
import type { Query } from './surface';
import type { Consent, SignalStatus } from './types';

export const signalStatusKey = (userId: string | null) => ['signal-status', userId] as const;
export const whatTheAppSawKey = (userId: string | null) => ['what-the-app-saw', userId] as const;

async function myConsent(): Promise<Consent | null> {
  const { data } = await getSupabase().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  return unwrap(await getSupabase().from('consents').select('*').eq('user_id', userId).single());
}

/** Start or stop on-phone collection to match consent. Called after consent changes and on app open. */
export async function syncSignalsWithConsent(consent: Pick<Consent, 'location' | 'health'>): Promise<void> {
  if (consent.location) {
    await startLocationSignals((await readStore()).home);
  } else {
    await stopLocationSignals();
    await clearLocationData();
  }
  if (consent.location || (consent.health && HEALTHKIT_ENABLED)) await registerDailyTask();
  else await unregisterDailyTask();
}

/** Stop everything and wipe the on-phone store (sign-out, account deletion). */
export async function stopAllSignals(): Promise<void> {
  await stopLocationSignals().catch(() => {});
  await unregisterDailyTask().catch(() => {});
  await clearAll();
}

export function useSignalStatus(): Query<SignalStatus> {
  const userId = useUserId();
  return useQuery<SignalStatus, Error>({
    queryKey: signalStatusKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const [perms, store, last] = await Promise.all([
        locationPermissions(),
        readStore(),
        getSupabase()
          .from('daily_signals')
          .select('uploaded_at')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        locationForeground: perms.foreground,
        locationBackground: perms.background,
        healthAvailable: HEALTHKIT_ENABLED,
        homeSet: !!store.home,
        lastUploadAt: last.data?.uploaded_at ?? null,
      };
    },
  });
}

/** Asks only for what consent allows: location (when-in-use → always), then Health (sleep + steps). */
export async function requestSignalPermissions(): Promise<void> {
  const consent = await myConsent();
  if (!consent) throw new Error('Not signed in');
  if (!consent.location && !(consent.health && HEALTHKIT_ENABLED)) {
    throw new Error('Turn on "Location summary" or "Sleep and steps" first.');
  }
  if (consent.location) await requestLocationPermissions();
  if (consent.health && HEALTHKIT_ENABLED) await requestHealthAccess();
  await syncSignalsWithConsent(consent);
}

/** Testing aid: computes and uploads yesterday's row now, even if it was already sent. */
export async function uploadSignalsNow(): Promise<string> {
  const row = await uploadIfDue(true);
  if (!row) return 'Nothing to send: turn on a signal and allow access first.';
  const parts = [
    row.hours_away_from_home !== null ? `${row.hours_away_from_home} h away` : null,
    row.places_visited !== null ? `${row.places_visited} places` : null,
    row.sleep_hours !== null ? `${row.sleep_hours} h sleep` : null,
    row.steps !== null ? `${row.steps} steps` : null,
  ].filter(Boolean);
  return `Sent ${row.day}: ${parts.join(', ') || 'no numbers'}`;
}

export async function setHomeLocation(): Promise<void> {
  const consent = await myConsent();
  if (!consent?.location) throw new Error('Turn on "Location summary" first.');
  await setHomeHere();
}

/**
 * Mount once in the root layout (signed in): on launch and each return to the foreground,
 * make sure collection matches consent and upload yesterday's row if the background task didn't.
 */
export function useSignalSync(): void {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);

  useEffect(() => {
    // Signed out (or switched account): stop collecting and wipe the on-phone store.
    if (previousUser.current && previousUser.current !== userId) void stopAllSignals();
    previousUser.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      try {
        const consent = await myConsent();
        if (!consent) return;
        await syncSignalsWithConsent(consent);
        if (await uploadIfDue()) {
          void queryClient.invalidateQueries({ queryKey: whatTheAppSawKey(userId) });
          void queryClient.invalidateQueries({ queryKey: signalStatusKey(userId) });
        }
      } catch (e) {
        console.warn('signal sync failed', e);
      }
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => sub.remove();
  }, [userId, queryClient]);
}
