// A4.7 demo controls (built by Developer B under the plan's load-balancing handoff).
// Only app/(dev)/demo uses this. Every call sends x-demo-key (EXPO_PUBLIC_DEMO_KEY), which the
// server checks against the DEMO_KEY secret (plan §4.2). The server never says which nudges
// were drift vs cover; responses are just { ok, summary }.
import { DEMO_KEY_HEADER, type DemoRunResponse } from '@shared/api';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from './client';
import { DEMO_KEY, USE_MOCKS } from './config';

export type DemoAction =
  | { kind: 'reseed' }
  | { kind: 'drift-and-nudge' }
  | { kind: 'score-drift' }
  | { kind: 'scheduler'; now: string; label: string };

export type { DemoRunResponse };

/** False when EXPO_PUBLIC_DEMO_KEY is missing from .env.local (real mode can't run demo calls). */
export const demoKeyConfigured = DEMO_KEY.length > 0;

export function describeDemoAction(action: DemoAction): string {
  switch (action.kind) {
    case 'reseed':
      return 'Reset demo';
    case 'drift-and-nudge':
      return 'Run drift + nudge';
    case 'score-drift':
      return 'Score drift only';
    case 'scheduler':
      return `Scheduler: ${action.label}`;
  }
}

function endpoint(action: DemoAction): string {
  switch (action.kind) {
    case 'reseed':
      return 'demo-reseed';
    case 'drift-and-nudge':
      return 'nudge-engine?demo=true';
    case 'score-drift':
      return 'nightly-drift';
    case 'scheduler':
      return `rhythm-scheduler?now=${encodeURIComponent(action.now)}`;
  }
}

async function readErrorBody(error: unknown): Promise<{ summary?: string; error?: string } | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    return (await (error.context as Response).json()) as { summary?: string; error?: string };
  } catch {
    return null;
  }
}

async function runDemoAction(action: DemoAction): Promise<DemoRunResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: true, summary: `(mock) ${describeDemoAction(action)} done` };
  }
  if (!demoKeyConfigured) {
    throw new Error('EXPO_PUBLIC_DEMO_KEY is not set. Add it to .env.local (ask Developer B) and restart Metro.');
  }

  const { data, error } = await getSupabase().functions.invoke<DemoRunResponse>(endpoint(action), {
    headers: { [DEMO_KEY_HEADER]: DEMO_KEY },
    body: {},
    timeout: 60_000, // drift + nudge calls the LLM; give it room
  });
  if (error) {
    const body = await readErrorBody(error);
    if (body?.summary) return { ok: false, summary: body.summary }; // e.g. "Demo accounts not signed up yet: ..."
    if (body?.error) throw new Error(body.error === 'unauthorized' ? 'Demo key rejected (check EXPO_PUBLIC_DEMO_KEY).' : body.error);
    throw error instanceof Error ? error : new Error(String(error));
  }
  return data ?? { ok: false, summary: 'Empty response' };
}

/** Run one demo action. On success, refetch everything so this phone shows the new state. */
export function useDemoAction() {
  const queryClient = useQueryClient();
  return useMutation<DemoRunResponse, Error, DemoAction>({
    mutationFn: runDemoAction,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
