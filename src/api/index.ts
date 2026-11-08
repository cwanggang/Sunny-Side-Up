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
export { ApiProvider } from './provider';
export type * from './types';
