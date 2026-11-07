// Contract: inputs/outputs for RPCs and Edge Functions (plan.md §4.2).
// Change only by agreement of both developers, in a separate `contract:` commit.
// Row types come from the generated `database.types.ts` (Developer B runs `supabase gen types`).

import type { Database } from './database.types';

type PublicTables = Database['public']['Tables'];
export type CircleRow = PublicTables['circles']['Row'];

// ---------- RPCs (call with supabase.rpc(name, args)) ----------

export interface CreateCircleArgs {
  name: string;
  home_area: string | null;
}
export type CreateCircleResult = CircleRow;

export interface JoinCircleArgs {
  invite_code: string;
}
export type JoinCircleResult = CircleRow;

export interface LeaveCircleArgs {
  circle_id: string;
}
export type LeaveCircleResult = void;

export interface RegisterPushTokenArgs {
  token: string;
}
export type RegisterPushTokenResult = void;

// ---------- Edge Functions (call with supabase.functions.invoke(name, { body })) ----------

export interface HangoutIdeasRequest {
  circle_id: string;
}
export interface HangoutIdea {
  title: string;
  why: string;
  where: string;
}
export interface HangoutIdeasResponse {
  ideas: HangoutIdea[];
}

/** delete-account: no body. Deletes the caller's rows, media, and auth user. */
export interface DeleteAccountResponse {
  ok: true;
}

// ---------- Demo controls (only the (dev) screen calls these) ----------

/** Header every demo call must send; value comes from EXPO_PUBLIC_DEMO_KEY. */
export const DEMO_KEY_HEADER = 'x-demo-key';

/** rhythm-scheduler?now=<iso> forces the scheduler as if it were that time. */
export interface RhythmSchedulerQuery {
  now?: string; // ISO 8601
}
/** nudge-engine?demo=true runs drift + nudge immediately for the seeded circle. */
export interface NudgeEngineQuery {
  demo?: 'true';
}
export interface DemoRunResponse {
  ok: boolean;
  /** Short human-readable summary for the demo screen, e.g. "2 nudges sent". */
  summary: string;
}

// ---------- Push notifications ----------

export type PushType = 'interaction' | 'nudge' | 'share_open' | 'spotlight' | 'birthday' | 'moment';

/** `data` payload of every push. The app routes on `type`. */
export interface PushPayload {
  type: PushType;
  circle_id: string;
  target_id?: string;
}

// ---------- Storage ----------

export const MEDIA_BUCKET = 'media';
/** Path for interaction / share media: `{circle_id}/{interaction_or_share_id}.{ext}` */
export const mediaPath = (circleId: string, itemId: string, ext: string) => `${circleId}/${itemId}.${ext}`;
