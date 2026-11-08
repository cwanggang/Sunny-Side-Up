// @/api: the ONLY data import for screens and components (plan.md §0.4).
// EXPO_PUBLIC_USE_MOCKS=true swaps every hook for its mock in src/mocks.
import { api as mockApi } from '@/mocks';

import { USE_MOCKS } from './config';
import { api as realApi } from './real';
import type { ApiSurface } from './surface';

const api: ApiSurface = USE_MOCKS ? mockApi : realApi;

export const {
  // Auth
  useSession,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  // Profile, consent, privacy
  useMyProfile,
  useUpdateProfile,
  useConsent,
  useUpdateConsent,
  usePause,
  useWhatTheAppSaw,
  useDeleteAccount,
  // Circles
  useMyCircles,
  useCircle,
  useCircleMembers,
  useCreateCircle,
  useJoinCircle,
  useInviteLink,
  useLeaveCircle,
  // Feed and media
  useFeed,
  useSendEgg,
  useSendText,
  useSendPhoto,
  useSendVoice,
  useReact,
  usePhotoPicker,
  useCameraCapture,
  useVoiceRecorder,
  useVoicePlayer,
  useMediaUrl,
  // Rhythm and closeness
  useSundayShare,
  usePostShare,
  useSpotlight,
  useBirthdays,
  useMoments,
  useCreateMoment,
  // Nudges and hangouts
  useMyNudges,
  useMarkNudgeActed,
  useHangoutIdeas,
  useReportAppOpen,
  // Device
  useNotifications,
  useNotificationRouting,
  useInviteLinkHandler,
  // Signals
  useSignalStatus,
  requestSignalPermissions,
  setHomeLocation,
} = api;

export { HEALTHKIT_ENABLED, USE_MOCKS } from './config';
export { rememberInviteCode } from './invite';
export { isVoicePath } from './rhythm';
// A4.7 demo controls (Developer B handoff); only app/(dev)/demo uses these.
export { demoKeyConfigured, describeDemoAction, useDemoAction, type DemoAction } from './demo';
// Design v0.3 (Developer B, Phase 5 handoff): daily photo, Sunday eggs, reactions on shares.
export {
  REACTION_EMOJI,
  eggStyleOf,
  useDailyPrompt,
  usePostDailyPhoto,
  useSendSundayEgg,
  useShareReactions,
  useSundayEgg,
  useToggleShareReaction,
  type EggStyle,
  type ShareReaction,
  type SundayEgg,
} from './design';
// Design v0.4 (Developer B): coops, profiles, gallery, daily, events.
export {
  eggOf,
  factsOf,
  formatCoopCode,
  inviteMessage,
  pickPhotos,
  useAddPhotos,
  useCoop,
  useCoopPeople,
  useCoops,
  useCreateCoop,
  useDaily,
  useFactIdeas,
  useGallery,
  useJoinCoop,
  useLeaveCoop,
  useMyFullProfile,
  usePeople,
  useSaveProfile,
  type CoopSummary,
  type DailyDay,
  type EggLook,
  type Fact,
  type FullProfile,
  type GalleryPhoto,
  type Person,
  type PickedPhoto,
} from './coops';
export {
  CHAT_LENGTHS,
  chatClosesAt,
  chatOpen,
  isPast,
  useAddGuestToCoop,
  useAlbumCounts,
  useCreateEvent,
  useEvent,
  useEventMessages,
  useEventPeople,
  useEventPhotos,
  useEvents,
  useSendEventMessage,
  useSetChatTimer,
  useSetEventPerson,
  useSetOptOut,
  type EventMessage,
  type EventPerson,
  type EventPhoto,
  type EventRole,
  type EventRow,
  type EventSummary,
} from './events';
export { ApiProvider } from './provider';
export type * from './types';
