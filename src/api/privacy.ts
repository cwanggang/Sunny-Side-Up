// A4.6: what the app saw, pause, delete account.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { unwrap } from './errors';
import { consentKey } from './profile';
import { stopAllSignals, whatTheAppSawKey } from './signals';
import type { Mutation, Query } from './surface';
import type { Consent, DailySignal } from './types';

/** My own uploaded daily rows (last 14 days), newest first: exactly what the server has. */
export function useWhatTheAppSaw(): Query<DailySignal[]> {
  const userId = useUserId();
  return useQuery<DailySignal[], Error>({
    queryKey: whatTheAppSawKey(userId),
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await getSupabase().from('daily_signals').select('*').order('day', { ascending: false }).limit(14),
      ),
  });
}

/** Pause until a time (no nudges about me, no reminders to me), or `null` to resume now. */
export function usePause(): Mutation<{ until: string | null }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { until: string | null }>({
    mutationFn: async ({ until }) => {
      if (!userId) throw new Error('Not signed in');
      const consent: Consent = unwrap(
        await getSupabase().from('consents').update({ paused_until: until }).eq('user_id', userId).select('*').single(),
      );
      queryClient.setQueryData(consentKey(userId), consent);
    },
  });
}

/** Deletes my account on the server (B4.6), wipes on-phone signal data, and signs out. */
export function useDeleteAccount(): Mutation<void> {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const supabase = getSupabase();
      const { error } = await supabase.functions.invoke('delete-account', { body: {}, timeout: 60_000 });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const detail = (await (error.context as Response).json().catch(() => null)) as { error?: string } | null;
          if (detail?.error) throw new Error(detail.error);
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
      await stopAllSignals();
      // The auth user no longer exists, so only clear the session on this phone.
      await supabase.auth.signOut({ scope: 'local' });
    },
  });
}
