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

// ---------- Notifications (plan §3.0 / §4.2: no remote push) ----------
// The server inserts `notifications` rows (see database.types.ts for the row type). The app
// subscribes to its own rows over Realtime, shows title/body as a local notification, routes on
// type + circle_id + target_id when tapped, and sets read_at.

export type NotificationType = 'interaction' | 'nudge' | 'share_open' | 'spotlight' | 'birthday' | 'moment';

/**
 * What target_id points at, per type:
 *   interaction -> interaction id
 *   nudge       -> nudge id (my_nudges.id)
 *   share_open  -> ISO week, e.g. '2026-W45' (shares.period_key)
 *   spotlight   -> user id of today's spotlight person
 *   birthday    -> user id of the birthday person
 *   moment      -> moment id
 */

// ---------- Storage ----------

export const MEDIA_BUCKET = 'media';
/** Path for interaction / share media: `{circle_id}/{interaction_or_share_id}.{ext}` */
export const mediaPath = (circleId: string, itemId: string, ext: string) => `${circleId}/${itemId}.${ext}`;
