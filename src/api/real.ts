// Real implementation of the @/api surface. Each area lives in its own file (auth.ts,
// profile.ts, circles.ts, feed.ts, rhythm.ts, signals.ts, ...); this file only assembles them.
import { captureImage, pickImage, useNativeAudioPlayer, useNativeVoiceRecorder } from '@/native';

import { signInWithEmail, signOut, signUpWithEmail, useSession } from './auth';
import {
  useCircle,
  useCircleMembers,
  useCreateCircle,
  useInviteLink,
  useJoinCircle,
  useLeaveCircle,
  useMyCircles,
} from './circles';
import { useFeed, useReact, useSendEgg, useSendPhoto, useSendText, useSendVoice } from './feed';
import { useHangoutIdeas, useReportAppOpen } from './hangouts';
import { makeInviteLinkHandler } from './invite';
import { useNotifications } from './notifications';
import { useMarkNudgeActed, useMyNudges } from './nudges';
import { useDeleteAccount, usePause, useWhatTheAppSaw } from './privacy';
import { useConsent, useMyProfile, useUpdateConsent, useUpdateProfile } from './profile';
import {
  useBirthdays,
  useCreateMoment,
  useMoments,
  usePostShare,
  useSpotlight,
  useSundayShare,
} from './rhythm';
import { useNotificationRouting } from './routing';
import {
  requestSignalPermissions,
  setHomeLocation,
  uploadSignalsNow,
  useSignalStatus,
  useSignalSync,
} from './signals';
import { useMediaUrl } from './storage';
import type { ApiSurface } from './surface';

export const api: ApiSurface = {
  // Auth (A1.1)
  useSession,
  signUpWithEmail,
  signInWithEmail,
  signOut,

  // Profile and consent
  useMyProfile,
  useUpdateProfile,
  useConsent,
  useUpdateConsent,
  usePause,
  useWhatTheAppSaw,
  useDeleteAccount,

  // Circles (A1.3)
  useMyCircles,
  useCircle,
  useCircleMembers,
  useCreateCircle,
  useJoinCircle,
  useInviteLink,
  useLeaveCircle,

  // Feed (A2.1–A2.4)
  useFeed,
  useSendEgg,
  useSendText,
  useSendPhoto,
  useSendVoice,
  useReact,

  // Media (A2.3–A2.4)
  usePhotoPicker: () => pickImage,
  useCameraCapture: () => captureImage,
  useVoiceRecorder: useNativeVoiceRecorder,
  useVoicePlayer: useNativeAudioPlayer,
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
  useInviteLinkHandler: makeInviteLinkHandler(useSession),

  // Signals
  useSignalStatus,
  requestSignalPermissions,
  setHomeLocation,
  uploadSignalsNow,
  useSignalSync,
};
