// Real implementation of the @/api surface. In Phase 0 every hook is a stub that
// fails with a clear "not implemented yet (task ID)" error; each task replaces
// its stubs with real Supabase calls. Use EXPO_PUBLIC_USE_MOCKS=true until then.
import { useMutation, useQuery } from '@tanstack/react-query';

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
  useSession: () => ({ session: null, loading: false }),
  signUpWithEmail: rejectWith('A1.1'),
  signInWithEmail: rejectWith('A1.1'),
  signOut: rejectWith('A1.1'),

  // Profile and consent
  useMyProfile: () => useStubQuery(['profile'], 'A1.2'),
  useUpdateProfile: () => useStubMutation('A1.2'),
  useConsent: () => useStubQuery(['consent'], 'A1.2'),
  useUpdateConsent: () => useStubMutation('A1.2'),
  usePause: () => useStubMutation('A4.6'),
  useWhatTheAppSaw: () => useStubQuery(['what-the-app-saw'], 'A4.6'),
  useDeleteAccount: () => useStubMutation('A4.6'),

  // Circles (A1.3)
  useMyCircles: () => useStubQuery(['circles'], 'A1.3'),
  useCircle: (id) => useStubQuery(['circle', id], 'A1.3'),
  useCircleMembers: (id) => useStubQuery(['circle-members', id], 'A1.3'),
  useCreateCircle: () => useStubMutation('A1.3'),
  useJoinCircle: () => useStubMutation('A1.3'),
  useInviteLink: () => null,
  useLeaveCircle: () => useStubMutation('A1.3'),

  // Feed
  useFeed: (circleId) => useStubQuery(['feed', circleId], 'A2.1'),
  useSendEgg: () => useStubMutation('A2.2'),
  useSendText: () => useStubMutation('A2.2'),
  useSendPhoto: () => useStubMutation('A2.3'),
  useSendVoice: () => useStubMutation('A2.4'),
  useReact: () => useStubMutation('A2.2'),

  // Media
  usePhotoPicker: () => rejectWith('A2.3'),
  useCameraCapture: () => rejectWith('A2.3'),
  useVoiceRecorder: () => ({
    start: rejectWith('A2.4'),
    stop: rejectWith('A2.4'),
    isRecording: false,
    durationMs: 0,
    uri: null,
  }),
  useMediaUrl: (path) => useStubQuery(['media-url', path], 'A2.4'),

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

  // Device (no-ops until A1.4 / A2.5)
  useNotifications: () => ({ unread: [] }),
  useNotificationRouting: () => {},
  useInviteLinkHandler: () => {},

  // Signals
  useSignalStatus: () => useStubQuery(['signal-status'], 'A4.1'),
  requestSignalPermissions: rejectWith('A4.1'),
  setHomeLocation: rejectWith('A4.2'),
};
