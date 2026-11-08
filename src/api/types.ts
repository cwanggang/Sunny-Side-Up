// View models that screens see. Row shapes come from the generated contract
// (shared/database.types.ts); the rest are app-side shapes owned by Developer A.
import type { Database } from '@shared/database.types';
import type { HangoutIdea } from '@shared/api';
import type { Session } from '@supabase/supabase-js';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type { HangoutIdea, Session };

// ---------- Profile & consent ----------
export type Profile = Tables['profiles']['Row'];
export type ProfileUpdate = Partial<Pick<Profile, 'display_name' | 'avatar_path' | 'birthday' | 'timezone'>>;
export type Consent = Tables['consents']['Row'];
export type ConsentUpdate = Partial<
  Pick<Consent, 'location' | 'health' | 'auto_nudges' | 'notify_daily_photo' | 'notify_sunday' | 'notify_friend_posts'>
>;
export type DailySignal = Tables['daily_signals']['Row'];

// ---------- Circles ----------
export type Circle = Tables['circles']['Row'];
export type CircleRole = Enums['circle_role'];
export interface CircleMember {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  birthday: string | null;
  role: CircleRole;
  joinedAt: string;
}
export interface InviteLink {
  code: string;
  /** sunnysideup://join/<code> */
  url: string;
  /** Share-sheet text: contains the link AND the plain code (A1.3). */
  message: string;
}

// ---------- Feed ----------
export type InteractionKind = Enums['interaction_kind'];
export type Interaction = Tables['interactions']['Row'];
export type Reaction = Tables['reactions']['Row'];
export type FeedItem = Interaction & { reactions: Reaction[] };
/** Who an interaction goes to. `recipientId` null/undefined = whole circle. */
export interface SendTarget {
  circleId: string;
  recipientId?: string | null;
}

// ---------- Media ----------
export interface VoiceRecorder {
  /** Asks for the microphone if needed, then records (stops by itself at 60 seconds). */
  start(): Promise<void>;
  /** Stops and returns the local file URI (m4a), or null if nothing was recorded. */
  stop(): Promise<string | null>;
  /** Forget the finished recording (after sending or discarding it). */
  reset(): void;
  isRecording: boolean;
  /** Live while recording; the finished recording's length afterwards. */
  durationMs: number;
  /** The finished recording, or null. */
  uri: string | null;
}
export interface VoicePlayer {
  ready: boolean;
  playing: boolean;
  durationSec: number;
  positionSec: number;
  toggle(): Promise<void>;
}

// ---------- Rhythm & closeness ----------
export type ShareKind = Enums['share_kind'];
export type Share = Tables['shares']['Row'];
export interface SundayShare {
  /** ISO week ending this coming (or current) Sunday, e.g. '2026-W45'. Posts during the week count toward it. */
  periodKey: string;
  /** True on Sunday, when the server sends the "share your week" prompt. Posting is allowed any day. */
  isOpen: boolean;
  /** This week's posts, oldest first. */
  posts: Share[];
  previousPeriodKey: string;
  /** Last week's posts (shown so the screen isn't empty early in the week). */
  previousPosts: Share[];
}
export interface PostShareInput {
  circleId: string;
  kind: ShareKind;
  body?: string;
  /** Local photo (.jpg) or voice memo (.m4a) to upload with the post. */
  mediaUri?: string;
}
export interface SpotlightDay {
  day: string;
  userId: string;
  displayName: string;
}
export interface Spotlight {
  today: SpotlightDay | null;
  /** Today and the next 6 days that have someone scheduled. */
  week: SpotlightDay[];
  /** Today's spotlight posts (kind 'spotlight', period_key = today), oldest first. */
  posts: Share[];
}
export interface Birthday {
  userId: string;
  displayName: string;
  birthday: string;
  /** Next occurrence (YYYY-MM-DD). */
  nextOn: string;
  /** 0 = today. */
  daysUntil: number;
}
export type Moment = Tables['moments']['Row'];
export interface CreateMomentInput {
  circleId: string;
  title: string;
  occursOn: string;
}

// ---------- Nudges ----------
/** From the `my_nudges` view, which never exposes reason_kind (plan.md §9.4). */
export interface Nudge {
  id: string;
  circleId: string;
  circleName: string;
  aboutUserId: string;
  /** The friend to reach out to (display name). */
  aboutName: string;
  message: string;
  sentAt: string;
  actedAt: string | null;
}

// ---------- Notifications (plan.md §4.1 `notifications` table) ----------
export type NotificationType = Enums['notification_type'];
/** One `notifications` row (own rows only, by RLS). */
export type AppNotification = Tables['notifications']['Row'];

// ---------- Signals ----------
export type PermissionState = 'granted' | 'denied' | 'undetermined';
export interface SignalStatus {
  locationForeground: PermissionState;
  locationBackground: PermissionState;
  /** False when ENABLE_HEALTHKIT is off in app.config.ts. */
  healthAvailable: boolean;
  homeSet: boolean;
  lastUploadAt: string | null;
}
