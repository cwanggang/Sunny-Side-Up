// Real implementation of the @/api surface. Each area lives in its own file (auth.ts,
// profile.ts, circles.ts, ...); hooks not built yet are stubs that fail with a clear
// "not implemented yet (task ID)" error. Use EXPO_PUBLIC_USE_MOCKS=true for those screens.
import { useMutation, useQuery } from '@tanstack/react-query';

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
import { makeInviteLinkHandler } from './invite';
import { useNotifications } from './notifications';
import { useConsent, useMyProfile, useUpdateConsent, useUpdateProfile } from './profile';
import { useNotificationRouting } from './routing';
import { useMediaUrl } from './storage';
import type { ApiSurface, Mutation, Query } from './surface';

const notYet = (task: string) =>
  new Error(`Not implemented yet (${task}). Set EXPO_PUBLIC_USE_MOCKS=true to use mock data.`);

function useStubQuery<T>(key: readonly unknown[], task: string): Query<T> {
  return useQuery<T, Error>({
    queryKey: ['stub', ...key],
    queryFn: () => Promise.reject(notYet(task)),
    retry: false,
  });
}

function useStubMutation<TVars, TResult = void>(task: string): Mutation<TVars, TResult> {
  return useMutation<TResult, Error, TVars>({
    mutationFn: () => Promise.reject(notYet(task)),
  });
}

const rejectWith = (task: string) => () => Promise.reject(notYet(task));

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
  usePause: () => useStubMutation('A4.6'),
  useWhatTheAppSaw: () => useStubQuery(['what-the-app-saw'], 'A4.6'),
  useDeleteAccount: () => useStubMutation('A4.6'),

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
  useSundayShare: (circleId) => useStubQuery(['sunday', circleId], 'A3.1'),
  usePostShare: () => useStubMutation('A3.1'),
  useSpotlight: (circleId) => useStubQuery(['spotlight', circleId], 'A3.2'),
  useBirthdays: (circleId) => useStubQuery(['birthdays', circleId], 'A3.3'),
  useMoments: (circleId) => useStubQuery(['moments', circleId], 'A3.3'),
  useCreateMoment: () => useStubMutation('A3.3'),

  // Nudges and hangouts
  useMyNudges: () => useStubQuery(['nudges'], 'A4.6'),
  useMarkNudgeActed: () => useStubMutation('A4.6'),
  useHangoutIdeas: (circleId) => useStubQuery(['hangouts', circleId], 'A3.4'),

  // Device
  useNotifications,
  useNotificationRouting,
  useInviteLinkHandler: makeInviteLinkHandler(useSession),

  // Signals
  useSignalStatus: () => useStubQuery(['signal-status'], 'A4.1'),
  requestSignalPermissions: rejectWith('A4.1'),
  setHomeLocation: rejectWith('A4.2'),
};
