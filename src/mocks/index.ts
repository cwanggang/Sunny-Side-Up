// Mock implementation of the @/api surface, used when EXPO_PUBLIC_USE_MOCKS=true.
// Same shapes as the real hooks, so screens can be built before the backend is wired.
// Rule (plan.md §8): when a real hook changes shape, update its mock in the same commit.
import { buildInviteLink } from '@/api/circles';
import { makeInviteLinkHandler } from '@/api/invite';
import type { ApiSurface, Mutation, Query } from '@/api/surface';
import type {
  Circle,
  CircleMember,
  Consent,
  ConsentUpdate,
  FeedItem,
  Moment,
  Nudge,
  Profile,
  ProfileUpdate,
  Share,
  VoicePlayer,
  VoiceRecorder,
} from '@/api/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { MOCK_USER_ID, signInWithEmail, signOut, signUpWithEmail, useSession } from './auth';

const ME = MOCK_USER_ID;
const CIRCLE_ID = 'demo-circle';
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const dateIn = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString().slice(0, 10);
const delay = <T,>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const profile: Profile = {
  id: ME,
  display_name: 'Caden',
  avatar_path: null,
  birthday: '2004-03-14',
  timezone: 'America/New_York',
  created_at: daysAgo(20),
};

const consent: Consent = {
  user_id: ME,
  location: true,
  health: false,
  auto_nudges: true,
  paused_until: null,
  notify_daily_photo: true,
  notify_friend_posts: true,
  notify_sunday: true,
  updated_at: daysAgo(20),
};

const circle: Circle = {
  id: CIRCLE_ID,
  name: 'Sunny Crew',
  home_area: 'Durham, NC',
  invite_code: 'SUNNY1',
  created_by: ME,
  created_at: daysAgo(20),
};

const members: CircleMember[] = [
  { userId: ME, displayName: 'Caden', avatarPath: null, birthday: '2004-03-14', role: 'owner', joinedAt: daysAgo(20) },
  { userId: 'u-ella', displayName: 'Ella', avatarPath: null, birthday: '2004-11-20', role: 'member', joinedAt: daysAgo(19) },
  { userId: 'u-valerie', displayName: 'Valerie', avatarPath: null, birthday: '2005-01-09', role: 'member', joinedAt: daysAgo(19) },
  { userId: 'u-johnathon', displayName: 'Johnathon', avatarPath: null, birthday: null, role: 'member', joinedAt: daysAgo(18) },
];
const nameOf = (id: string) => members.find((m) => m.userId === id)?.displayName ?? 'Someone';

const feed: FeedItem[] = [
  { id: 'i1', circle_id: CIRCLE_ID, sender_id: 'u-ella', recipient_id: null, kind: 'egg', media_path: null, body: null, created_at: daysAgo(0.1), reactions: [] },
  { id: 'i2', circle_id: CIRCLE_ID, sender_id: 'u-valerie', recipient_id: null, kind: 'text', media_path: null, body: 'Who is around Saturday?', created_at: daysAgo(0.5), reactions: [{ interaction_id: 'i2', user_id: ME, emoji: '🙋', created_at: daysAgo(0.4) }] },
  { id: 'i3', circle_id: CIRCLE_ID, sender_id: 'u-johnathon', recipient_id: ME, kind: 'egg', media_path: null, body: null, created_at: daysAgo(1), reactions: [] },
];

const sundayPosts: Share[] = [
  { id: 's1', circle_id: CIRCLE_ID, author_id: 'u-valerie', kind: 'sunday', period_key: '2026-W45', body: 'Finished my first 10k!', media_path: null, recipient_id: null, egg_style: null, created_at: daysAgo(0.2) },
];

const moments: Moment[] = [
  { id: 'm1', circle_id: CIRCLE_ID, user_id: 'u-ella', title: 'Internship interview', occurs_on: dateIn(2), created_at: daysAgo(1) },
];

const nudges: Nudge[] = [
  { id: 'n1', circleId: CIRCLE_ID, circleName: 'Sunny Crew', aboutUserId: 'u-ella', aboutName: 'Ella', message: "Haven't caught up with Ella in a bit. Send her an egg?", sentAt: daysAgo(0.05), actedAt: null },
];

function useMockQuery<T>(key: readonly unknown[], data: T): Query<T> {
  return useQuery<T, Error>({ queryKey: ['mock', ...key], queryFn: () => delay(data) });
}

function useMockMutation<TVars, TResult = void>(result?: TResult): Mutation<TVars, TResult> {
  return useMutation<TResult, Error, TVars>({ mutationFn: () => delay(result as TResult) });
}

/** Mock edit: merges the patch into the cached mock row so screens show the change. */
function useMockPatch<TVars extends object, T extends object>(key: string, current: T): Mutation<TVars, T> {
  const queryClient = useQueryClient();
  return useMutation<T, Error, TVars>({
    mutationFn: async (patch) => {
      const prev = queryClient.getQueryData<T>(['mock', key]) ?? current;
      const { avatarUri: _ignored, ...rest } = patch as TVars & { avatarUri?: string };
      return delay({ ...prev, ...rest });
    },
    onSuccess: (next) => queryClient.setQueryData(['mock', key], next),
  });
}

function useMockVoicePlayer(url: string | null): VoicePlayer {
  const [playing, setPlaying] = useState(false);
  return {
    ready: !!url,
    playing,
    durationSec: 4.2,
    positionSec: 0,
    toggle: async () => setPlaying((p) => !p),
  };
}

function useMockVoiceRecorder(): VoiceRecorder {
  const [isRecording, setRecording] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  return {
    isRecording,
    uri,
    durationMs: isRecording ? 0 : uri ? 4200 : 0,
    reset: () => setUri(null),
    start: async () => setRecording(true),
    stop: async () => {
      setRecording(false);
      const fake = 'file:///mock/voice.m4a';
      setUri(fake);
      return fake;
    },
  };
}

export const api: ApiSurface = {
  // Auth (mocks/auth.ts): starts signed in as Caden; sign out/in toggles it.
  useSession,
  signUpWithEmail,
  signInWithEmail,
  signOut,

  useMyProfile: () => useMockQuery(['profile'], profile),
  useUpdateProfile: () => useMockPatch<ProfileUpdate & { avatarUri?: string }, Profile>('profile', profile),
  useConsent: () => useMockQuery(['consent'], consent),
  useUpdateConsent: () => useMockPatch<ConsentUpdate, Consent>('consent', consent),
  usePause: () => useMockMutation(),
  useWhatTheAppSaw: () =>
    useMockQuery(['what-the-app-saw'], [
      { user_id: ME, day: dateIn(-1), hours_away_from_home: 6.5, places_visited: 4, sleep_hours: 7.2, steps: 8400, uploaded_at: daysAgo(0.3) },
    ]),
  useDeleteAccount: () => useMockMutation(),

  useMyCircles: () => useMockQuery(['circles'], [circle]),
  useCircle: (id) => useMockQuery(['circle', id], { ...circle, id }),
  useCircleMembers: (id) => useMockQuery(['circle-members', id], members),
  useCreateCircle: () => useMockMutation(circle),
  useJoinCircle: () => useMockMutation(circle),
  useInviteLink: () => buildInviteLink(circle),
  useLeaveCircle: () => useMockMutation(),

  useFeed: (circleId) => useMockQuery(['feed', circleId], feed),
  useSendEgg: () => useMockMutation(),
  useSendText: () => useMockMutation(),
  useSendPhoto: () => useMockMutation(),
  useSendVoice: () => useMockMutation(),
  useReact: () => useMockMutation(),

  usePhotoPicker: () => () => delay('file:///mock/photo.jpg'),
  useCameraCapture: () => () => delay('file:///mock/camera.jpg'),
  useVoiceRecorder: useMockVoiceRecorder,
  useVoicePlayer: useMockVoicePlayer,
  useMediaUrl: (path) => useMockQuery(['media-url', path], 'https://picsum.photos/400'),

  useSundayShare: (circleId) =>
    useMockQuery(['sunday', circleId], {
      periodKey: '2026-W45',
      isOpen: true,
      posts: sundayPosts,
      previousPeriodKey: '2026-W44',
      previousPosts: [],
    }),
  usePostShare: () => useMockMutation(),
  useSpotlight: (circleId) =>
    useMockQuery(['spotlight', circleId], {
      today: { day: dateIn(0), userId: 'u-valerie', displayName: nameOf('u-valerie') },
      week: members.map((m, i) => ({ day: dateIn(i), userId: m.userId, displayName: m.displayName })),
      posts: [],
    }),
  useBirthdays: (circleId) =>
    useMockQuery(['birthdays', circleId], [
      { userId: 'u-ella', displayName: 'Ella', birthday: '2004-11-20', nextOn: '2026-11-20', daysUntil: 13 },
      { userId: 'u-valerie', displayName: 'Valerie', birthday: '2005-01-09', nextOn: '2027-01-09', daysUntil: 63 },
    ]),
  useMoments: (circleId) => useMockQuery(['moments', circleId], moments),
  useCreateMoment: () => useMockMutation(),

  useMyNudges: () => useMockQuery(['nudges'], nudges),
  useMarkNudgeActed: () => useMockMutation(),
  useHangoutIdeas: (circleId) =>
    useMockQuery(['hangouts', circleId], [
      { title: 'Sunday picnic', why: 'Low effort, everyone can come and go', where: 'Duke Gardens' },
      { title: 'Taco night', why: 'Cheap and good for a group of four', where: 'Ninth Street' },
      { title: 'Board games', why: 'Cozy if the weather turns', where: "Someone's apartment" },
    ]),

  useReportAppOpen: () => {},

  useNotifications: () => ({ unread: [] }),
  useNotificationRouting: () => {},
  useInviteLinkHandler: makeInviteLinkHandler(useSession),

  useSignalStatus: () =>
    useMockQuery(['signal-status'], {
      locationForeground: 'granted',
      locationBackground: 'undetermined',
      healthAvailable: false,
      homeSet: false,
      lastUploadAt: null,
    }),
  requestSignalPermissions: () => delay(undefined),
  setHomeLocation: () => delay(undefined),
  uploadSignalsNow: () => delay('(mock) Sent yesterday: 6.5 h away, 4 places, 7.2 h sleep, 8400 steps'),
  useSignalSync: () => {},
};
