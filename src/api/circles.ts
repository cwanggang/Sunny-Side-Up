// A1.3: my circles, members, create / join / leave (RPCs from B1.2), and invite links.
import type { CreateCircleArgs, JoinCircleArgs } from '@shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { check, unwrap } from './errors';
import type { Mutation, Query } from './surface';
import type { Circle, CircleMember, InviteLink } from './types';

export const circlesKey = (userId: string | null) => ['circles', userId] as const;
export const circleKey = (id: string) => ['circle', id] as const;
export const membersKey = (id: string) => ['circle-members', id] as const;

/** Every circle I'm in (RLS returns only those), oldest first. */
export function useMyCircles(): Query<Circle[]> {
  const userId = useUserId();
  return useQuery<Circle[], Error>({
    queryKey: circlesKey(userId),
    enabled: !!userId,
    queryFn: async () => unwrap(await getSupabase().from('circles').select('*').order('created_at')),
  });
}

export function useCircle(id: string): Query<Circle> {
  return useQuery<Circle, Error>({
    queryKey: circleKey(id),
    enabled: !!id,
    queryFn: async () => unwrap(await getSupabase().from('circles').select('*').eq('id', id).single()),
  });
}

/** Members through the `circle_profiles` view (safe fields only). */
export function useCircleMembers(id: string): Query<CircleMember[]> {
  return useQuery<CircleMember[], Error>({
    queryKey: membersKey(id),
    enabled: !!id,
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase().from('circle_profiles').select('*').eq('circle_id', id).order('joined_at'),
      );
      return rows.flatMap((r) =>
        r.id
          ? [
              {
                userId: r.id,
                displayName: r.display_name || 'Friend',
                avatarPath: r.avatar_path,
                birthday: r.birthday,
                role: r.role ?? 'member',
                joinedAt: r.joined_at ?? '',
              },
            ]
          : [],
      );
    },
  });
}

function useOnCircleJoined() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return (circle: Circle) => {
    queryClient.setQueryData(circleKey(circle.id), circle);
    queryClient.invalidateQueries({ queryKey: circlesKey(userId) });
    queryClient.invalidateQueries({ queryKey: membersKey(circle.id) });
  };
}

export function useCreateCircle(): Mutation<CreateCircleArgs, Circle> {
  const onJoined = useOnCircleJoined();
  return useMutation<Circle, Error, CreateCircleArgs>({
    mutationFn: async ({ name, home_area }) =>
      unwrap(await getSupabase().rpc('create_circle', { name, home_area: home_area ?? undefined })),
    onSuccess: onJoined,
  });
}

/** Joining a circle I'm already in just returns it (the RPC is idempotent). */
export function useJoinCircle(): Mutation<JoinCircleArgs, Circle> {
  const onJoined = useOnCircleJoined();
  return useMutation<Circle, Error, JoinCircleArgs>({
    mutationFn: async ({ invite_code }) => unwrap(await getSupabase().rpc('join_circle', { invite_code })),
    onSuccess: onJoined,
  });
}

export function useLeaveCircle(): Mutation<{ circleId: string }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { circleId: string }>({
    mutationFn: async ({ circleId }) => {
      check(await getSupabase().rpc('leave_circle', { circle_id: circleId }));
    },
    onSuccess: (_, { circleId }) => {
      queryClient.invalidateQueries({ queryKey: circlesKey(userId) });
      queryClient.removeQueries({ queryKey: circleKey(circleId) });
      queryClient.removeQueries({ queryKey: membersKey(circleId) });
    },
  });
}

/**
 * Share-sheet invite. Messages may not make a custom-scheme link tappable, so the text
 * carries the plain code too; joining by code in the app is the fallback (plan A1.3).
 */
export function buildInviteLink(circle: Pick<Circle, 'name' | 'invite_code'>): InviteLink {
  const code = circle.invite_code;
  const url = `sunnysideup://join/${code}`;
  return {
    code,
    url,
    message: `Join "${circle.name}" on Sunny Side Up!\n\nTap: ${url}\n\nOr open the app, go to Circles, and enter code ${code}`,
  };
}

export function useInviteLink(circleId: string): InviteLink | null {
  const { data } = useCircle(circleId);
  return data ? buildInviteLink(data) : null;
}
