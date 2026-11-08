// A4.6: nudges I've received, from the `my_nudges` view (never exposes reason_kind, plan §9.4).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { circleKey, fetchCircleMembers, membersKey } from './circles';
import { getSupabase } from './client';
import { check, unwrap } from './errors';
import type { Mutation, Query } from './surface';
import type { Circle, Nudge } from './types';

export const nudgesKey = (userId: string | null) => ['nudges', userId] as const;

/** Newest first, with the friend's and circle's names filled in for display. */
export function useMyNudges(): Query<Nudge[]> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useQuery<Nudge[], Error>({
    queryKey: nudgesKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase();
      const rows = unwrap(
        await supabase.from('my_nudges').select('*').order('sent_at', { ascending: false }).limit(50),
      ).filter((r) => r.id && r.circle_id && r.about_user_id);

      const circleIds = [...new Set(rows.map((r) => r.circle_id!))];
      const [circles, memberLists] = await Promise.all([
        circleIds.length
          ? supabase.from('circles').select('*').in('id', circleIds).then((r) => unwrap(r) as Circle[])
          : Promise.resolve([] as Circle[]),
        Promise.all(
          circleIds.map((id) =>
            queryClient.fetchQuery({ queryKey: membersKey(id), queryFn: () => fetchCircleMembers(id) }),
          ),
        ),
      ]);
      circles.forEach((c) => queryClient.setQueryData(circleKey(c.id), c));
      const members = memberLists.flat();

      return rows.map((r) => ({
        id: r.id!,
        circleId: r.circle_id!,
        circleName: circles.find((c) => c.id === r.circle_id)?.name ?? 'your circle',
        aboutUserId: r.about_user_id!,
        aboutName: members.find((m) => m.userId === r.about_user_id)?.displayName ?? 'a friend',
        message: r.message ?? '',
        sentAt: r.sent_at ?? '',
        actedAt: r.acted_at,
      }));
    },
  });
}

/** Marks a nudge as done ("I reached out"). */
export function useMarkNudgeActed(): Mutation<{ nudgeId: string }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { nudgeId: string }>({
    mutationFn: async ({ nudgeId }) => {
      check(await getSupabase().from('my_nudges').update({ acted_at: new Date().toISOString() }).eq('id', nudgeId));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nudgesKey(userId) }),
  });
}
