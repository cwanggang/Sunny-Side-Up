// A3.1–A3.3: Sunday share, spotlight, birthdays and moments. The server (B3.1–B3.3) opens the
// Sunday share, rotates the spotlight and sends the reminders; this file reads and posts.
import { mediaPath } from '@shared/api';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { fetchCircleMembers, membersKey } from './circles';
import { getSupabase } from './client';
import { addDays, daysBetween, isoWeekKey, localDate, nextBirthday, weekdayOf } from './dates';
import { check, unwrap } from './errors';
import { newId } from './ids';
import { uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type {
  Birthday,
  CircleMember,
  CreateMomentInput,
  Moment,
  PostShareInput,
  Share,
  Spotlight,
  SundayShare,
} from './types';

export const sundayKey = (circleId: string) => ['sunday', circleId] as const;
export const spotlightKey = (circleId: string) => ['spotlight', circleId] as const;
export const birthdaysKey = (circleId: string) => ['birthdays', circleId] as const;
export const momentsKey = (circleId: string) => ['moments', circleId] as const;

/** Members from the React Query cache (shared with useCircleMembers), fetched if missing. */
const members = (queryClient: QueryClient, circleId: string): Promise<CircleMember[]> =>
  queryClient.fetchQuery({ queryKey: membersKey(circleId), queryFn: () => fetchCircleMembers(circleId) });

/** Voice memos are stored as .m4a, photos as .jpg. */
export const isVoicePath = (path: string | null | undefined) => !!path && path.endsWith('.m4a');

// ---------- Sunday share (A3.1) ----------

export function useSundayShare(circleId: string): Query<SundayShare> {
  return useQuery<SundayShare, Error>({
    queryKey: sundayKey(circleId),
    enabled: !!circleId,
    queryFn: async () => {
      const today = localDate();
      const periodKey = isoWeekKey(today);
      const previousPeriodKey = isoWeekKey(addDays(today, -7));
      const rows: Share[] = unwrap(
        await getSupabase()
          .from('shares')
          .select('*')
          .eq('circle_id', circleId)
          .eq('kind', 'sunday')
          .in('period_key', [periodKey, previousPeriodKey])
          .order('created_at'),
      );
      return {
        periodKey,
        isOpen: weekdayOf(today) === 0,
        posts: rows.filter((r) => r.period_key === periodKey),
        previousPeriodKey,
        previousPosts: rows.filter((r) => r.period_key === previousPeriodKey),
      };
    },
  });
}

/** Posts a Sunday share (this week) or a spotlight share (today), with optional photo or voice memo. */
export function usePostShare(): Mutation<PostShareInput> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, PostShareInput>({
    mutationFn: async ({ circleId, kind, body, mediaUri }) => {
      if (!userId) throw new Error('Not signed in');
      const text = body?.trim() || null;
      if (!text && !mediaUri) throw new Error('Add a few words, a photo, or a voice memo.');
      const id = newId();
      let path: string | null = null;
      if (mediaUri) {
        const voice = mediaUri.toLowerCase().endsWith('.m4a');
        path = mediaPath(circleId, id, voice ? 'm4a' : 'jpg');
        await uploadFile(path, mediaUri, voice ? 'audio/mp4' : 'image/jpeg');
      }
      const today = localDate();
      check(
        await getSupabase()
          .from('shares')
          .insert({
            id,
            circle_id: circleId,
            author_id: userId,
            kind,
            period_key: kind === 'sunday' ? isoWeekKey(today) : today,
            body: text,
            media_path: path,
          }),
      );
    },
    onSuccess: (_, { circleId, kind }) =>
      queryClient.invalidateQueries({ queryKey: kind === 'sunday' ? sundayKey(circleId) : spotlightKey(circleId) }),
  });
}

// ---------- Spotlight (A3.2) ----------

export function useSpotlight(circleId: string): Query<Spotlight> {
  const queryClient = useQueryClient();
  return useQuery<Spotlight, Error>({
    queryKey: spotlightKey(circleId),
    enabled: !!circleId,
    queryFn: async () => {
      const supabase = getSupabase();
      const today = localDate();
      const [days, posts, people] = await Promise.all([
        supabase
          .from('spotlight_days')
          .select('day, user_id')
          .eq('circle_id', circleId)
          .gte('day', today)
          .lte('day', addDays(today, 6))
          .order('day'),
        supabase
          .from('shares')
          .select('*')
          .eq('circle_id', circleId)
          .eq('kind', 'spotlight')
          .eq('period_key', today)
          .order('created_at'),
        members(queryClient, circleId),
      ]);
      const nameOf = (id: string) => people.find((m) => m.userId === id)?.displayName ?? 'Friend';
      const week = unwrap(days).map((d) => ({ day: d.day, userId: d.user_id, displayName: nameOf(d.user_id) }));
      return { today: week.find((d) => d.day === today) ?? null, week, posts: unwrap(posts) };
    },
  });
}

// ---------- Birthdays and moments (A3.3) ----------

/** Members with a birthday, soonest first. */
export function useBirthdays(circleId: string): Query<Birthday[]> {
  const queryClient = useQueryClient();
  return useQuery<Birthday[], Error>({
    queryKey: birthdaysKey(circleId),
    enabled: !!circleId,
    queryFn: async () => {
      const today = localDate();
      return (await members(queryClient, circleId))
        .flatMap((m) => {
          if (!m.birthday) return [];
          const nextOn = nextBirthday(m.birthday, today);
          return [{ userId: m.userId, displayName: m.displayName, birthday: m.birthday, nextOn, daysUntil: daysBetween(today, nextOn) }];
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);
    },
  });
}

/** Today's and upcoming moments, soonest first. */
export function useMoments(circleId: string): Query<Moment[]> {
  return useQuery<Moment[], Error>({
    queryKey: momentsKey(circleId),
    enabled: !!circleId,
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('moments')
          .select('*')
          .eq('circle_id', circleId)
          .gte('occurs_on', localDate())
          .order('occurs_on'),
      ),
  });
}

/** Adds one of *my* moments ("interview Tuesday"); friends get a shout-out reminder that morning. */
export function useCreateMoment(): Mutation<CreateMomentInput> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, CreateMomentInput>({
    mutationFn: async ({ circleId, title, occursOn }) => {
      if (!userId) throw new Error('Not signed in');
      const t = title.trim();
      if (!t) throw new Error('What is happening?');
      if (occursOn < localDate()) throw new Error('Pick today or a future date.');
      check(
        await getSupabase().from('moments').insert({ circle_id: circleId, user_id: userId, title: t, occurs_on: occursOn }),
      );
    },
    onSuccess: (_, { circleId }) => queryClient.invalidateQueries({ queryKey: momentsKey(circleId) }),
  });
}
