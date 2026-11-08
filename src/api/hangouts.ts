// A3.4: AI hangout ideas (B3.4 Edge Function) and app_open reporting.
import type { HangoutIdea, HangoutIdeasRequest } from '@shared/api';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { useUserId } from './auth';
import { getSupabase } from './client';
import type { Query } from './surface';

const ideasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), why: z.string(), where: z.string() })),
});

export const hangoutsKey = (circleId: string) => ['hangouts', circleId] as const;

/**
 * Three ideas from the LLM. Each call costs a model request, so results are kept until the
 * screen asks for more (refetch). The server falls back to canned ideas if the model fails.
 */
export function useHangoutIdeas(circleId: string): Query<HangoutIdea[]> {
  return useQuery<HangoutIdea[], Error>({
    queryKey: hangoutsKey(circleId),
    enabled: !!circleId,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const body: HangoutIdeasRequest = { circle_id: circleId };
      const { data, error } = await getSupabase().functions.invoke('hangout-ideas', { body, timeout: 30_000 });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const detail = (await (error.context as Response).json().catch(() => null)) as { error?: string } | null;
          if (detail?.error) throw new Error(detail.error);
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
      const parsed = ideasSchema.safeParse(data);
      if (!parsed.success) throw new Error('Got an unexpected answer from the server. Try again.');
      return parsed.data.ideas;
    },
  });
}

// ---------- app_open (A3.4, feeds B4.1 engagement counts) ----------

const THROTTLE_MS = 30 * 60 * 1000;
let lastReportAt = 0;

async function reportAppOpen() {
  if (Date.now() - lastReportAt < THROTTLE_MS) return;
  lastReportAt = Date.now();
  // user_id and kind default on the server, which also throttles to one per 30 minutes.
  const { error } = await getSupabase().from('app_events').insert({});
  if (error) {
    lastReportAt = 0;
    console.warn('app_open report failed', error.message);
  }
}

/** Mount once in the root layout: reports app_open on sign-in and each return to the foreground. */
export function useReportAppOpen(): void {
  const userId = useUserId();
  useEffect(() => {
    if (!userId) return;
    void reportAppOpen();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reportAppOpen();
    });
    return () => sub.remove();
  }, [userId]);
}
