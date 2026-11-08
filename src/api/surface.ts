// The full @/api hook surface (plan.md §4.3). Both the real implementation
// (src/api/real.ts) and the mocks (src/mocks) satisfy this interface, so screens
// can't tell which one they're using.
import type { CreateCircleArgs, JoinCircleArgs } from '@shared/api';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type {
  AppNotification,
  Birthday,
  Circle,
  CircleMember,
  Consent,
  ConsentUpdate,
  CreateMomentInput,
  DailySignal,
  FeedItem,
  HangoutIdea,
  InviteLink,
  Moment,
  Nudge,
  PostShareInput,
  Profile,
  ProfileUpdate,
  SendTarget,
  Session,
  SignalStatus,
  Spotlight,
  SundayShare,
  VoicePlayer,
  VoiceRecorder,
} from './types';

export type Query<T> = UseQueryResult<T, Error>;
export type Mutation<TVars, TResult = void> = UseMutationResult<TResult, Error, TVars>;

export interface ApiSurface {
  // Auth (A1.1)
  /** isNewAccount: true right after sign-up in this app run (drives onboarding). */
  useSession(): { session: Session | null; loading: boolean; isNewAccount: boolean };
  signUpWithEmail(email: string, password: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  // Profile (A1.2)
  useMyProfile(): Query<Profile>;
  /** `avatarUri`: a local photo to upload as the profile photo (avatars/{user_id}/photo.jpg). */
  useUpdateProfile(): Mutation<ProfileUpdate & { avatarUri?: string }, Profile>;

  // Consent and privacy (A1.2, A4.6)
  useConsent(): Query<Consent>;
  useUpdateConsent(): Mutation<ConsentUpdate, Consent>;
  /** `until` null = resume now. */
  usePause(): Mutation<{ until: string | null }>;
  useWhatTheAppSaw(): Query<DailySignal[]>;
  useDeleteAccount(): Mutation<void>;

  // Circles (A1.3)
  useMyCircles(): Query<Circle[]>;
  useCircle(id: string): Query<Circle>;
  useCircleMembers(id: string): Query<CircleMember[]>;
  useCreateCircle(): Mutation<CreateCircleArgs, Circle>;
  useJoinCircle(): Mutation<JoinCircleArgs, Circle>;
  useInviteLink(circleId: string): InviteLink | null;
  useLeaveCircle(): Mutation<{ circleId: string }>;

  // Feed (A2.1–A2.4)
  useFeed(circleId: string): Query<FeedItem[]>;
  useSendEgg(): Mutation<SendTarget>;
  useSendText(): Mutation<SendTarget & { body: string }>;
  useSendPhoto(): Mutation<SendTarget & { uri: string }>;
  useSendVoice(): Mutation<SendTarget & { uri: string; durationMs: number }>;
  useReact(): Mutation<{ interactionId: string; emoji: string }>;

  // Media (A2.3–A2.4). Pickers resolve to a local URI, or null if cancelled.
  usePhotoPicker(): (options?: { square?: boolean }) => Promise<string | null>;
  useCameraCapture(): (options?: { square?: boolean }) => Promise<string | null>;
  useVoiceRecorder(): VoiceRecorder;
  /** Play/pause a voice memo from a URL (signed media URL or a local recording). */
  useVoicePlayer(url: string | null): VoicePlayer;
  useMediaUrl(path: string | null): Query<string>;

  // Rhythm (A3.1–A3.2)
  useSundayShare(circleId: string): Query<SundayShare>;
  usePostShare(): Mutation<PostShareInput>;
  useSpotlight(circleId: string): Query<Spotlight>;

  // Closeness (A3.3)
  useBirthdays(circleId: string): Query<Birthday[]>;
  useMoments(circleId: string): Query<Moment[]>;
  useCreateMoment(): Mutation<CreateMomentInput>;

  // Nudges (A4.6)
  useMyNudges(): Query<Nudge[]>;
  useMarkNudgeActed(): Mutation<{ nudgeId: string }>;

  // Hangouts (A3.4)
  useHangoutIdeas(circleId: string): Query<HangoutIdea[]>;
  /** Mount once in the root layout: logs app_open (at most every 30 min) for engagement counts. */
  useReportAppOpen(): void;

  // Device (A1.4, A2.5)
  /** Call once after sign-in: realtime `notifications` rows → local notifications. */
  useNotifications(): { unread: AppNotification[] };
  /** Notification tap → screen. */
  useNotificationRouting(): void;
  /** sunnysideup://join/<code> → join flow. */
  useInviteLinkHandler(): void;

  // Signals (A4.1–A4.5)
  useSignalStatus(): Query<SignalStatus>;
  requestSignalPermissions(): Promise<void>;
  setHomeLocation(): Promise<void>;
}
