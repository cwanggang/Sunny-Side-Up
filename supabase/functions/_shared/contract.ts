// Copy of the parts of shared/api.ts that Edge Functions need (plan.md §11 fallback):
// the function bundler only ships files inside supabase/functions/, and shared/api.ts imports
// database.types without a .ts extension, which Deno can't resolve.
// RULE: any change to shared/api.ts must be mirrored here in the same commit.

export const DEMO_KEY_HEADER = 'x-demo-key';

export type NotificationType = 'interaction' | 'nudge' | 'share_open' | 'spotlight' | 'birthday' | 'moment' | 'event' | 'egg_war';

/** Notification settings (consents.notify_*). Rows tagged with a pref skip users who turned it off. */
export type NotificationPref = 'daily_photo' | 'sunday' | 'friend_posts';

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

/** fact-ideas (design v0.4): "suggest categories" on the profile. Send only category names. */
export interface FactIdeasRequest {
  have: string[];
}
export interface FactIdeasResponse {
  ideas: string[];
  /** 'claude' when the model answered, 'list' when the built-in list was used. */
  source: 'claude' | 'list';
}

export interface DeleteAccountResponse {
  ok: true;
}

export interface DemoRunResponse {
  ok: boolean;
  summary: string;
}

export const MEDIA_BUCKET = 'media';

// ---------- Design v0.3: daily photo + Sunny Sunday (contract change 2026-11-07) ----------
// Daily photo = a `spotlight` share (period_key 'YYYY-MM-DD'), posted only by that day's
// spotlight_days person (several per day allowed). Others react via `share_reactions`
// (share_id, user_id, emoji; same visibility as the share; in Realtime). Decoration: egg_style + body (egg text).
// Sunday egg = a `sunday` share with recipient_id = my sunday_pairs.receiver_id (period_key ISO week),
// one per person per circle per week; video (mp4/mov) or voice (m4a) in media_path. The recipient
// can read it only after sending their own egg that week.

export interface EggStyle {
  swatch: string;  // e.g. 'blush', 'mint', 'shell'
  pattern: string; // e.g. 'dots', 'zigzag', 'none'
}

/** rpc('daily_prompt', { p_day }) -> text. Same prompt for everyone on that date. */
export interface DailyPromptArgs {
  p_day?: string; // 'YYYY-MM-DD', default today (UTC)
}

/** rpc('sunday_status', { p_circle_id }) -> SundayStatus[] (0 rows: no pairs this week yet). */
export interface SundayStatusArgs {
  p_circle_id: string;
  p_period_key?: string; // default: latest week I'm paired in
}
export interface SundayStatus {
  period_key: string;
  send_to: string;               // user id I send my egg to ("your person")
  from_id: string | null;        // user id who sends one to me (same as send_to unless 3-person ring)
  i_sent: boolean;
  they_sent: boolean;            // an egg is waiting for me (show the gift)
  my_share_id: string | null;
  their_share_id: string | null; // only once i_sent
  prompt: string;                // e.g. "what made you think of Jun this week?"
}
