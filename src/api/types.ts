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
export type ConsentUpdate = Partial<Pick<Consent, 'location' | 'health' | 'auto_nudges'>>;
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
  start(): Promise<void>;
  /** Stops and returns the local file URI (m4a), or null if nothing was recorded. */
  stop(): Promise<string | null>;
  isRecording: boolean;
  durationMs: number;
  uri: string | null;
}

// ---------- Rhythm & closeness ----------
export type ShareKind = Enums['share_kind'];
export type Share = Tables['shares']['Row'];
export interface SundayShare {
  periodKey: string;
  isOpen: boolean;
  posts: Share[];
}
export interface PostShareInput {
  circleId: string;
  kind: ShareKind;
  body?: string;
  /** Local photo or voice file to upload with the post. */
  mediaUri?: string;
}
export interface SpotlightDay {
  day: string;
  userId: string;
  displayName: string;
}
export interface Spotlight {
  today: SpotlightDay | null;
  week: SpotlightDay[];
}
export interface Birthday {
  userId: string;
  displayName: string;
  birthday: string;
  /** Next occurrence (YYYY-MM-DD). */
  nextOn: string;
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
  aboutUserId: string;
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
