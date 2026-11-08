// Egg war (design v0.5 "play!"), on Developer B's backend (docs/proposals/egg-war-backend.md).
// Every write goes through an RPC; the tables are read-only. Status comes from `egg_war_status`,
// which also advances the war (vote → live/off, live → over) whenever it's called.
import type { EggWarChoice, EggWarStatus } from '@shared/api';
import { MEDIA_BUCKET, mediaPath } from '@shared/api';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabase } from './client';
import { USE_MOCKS } from './config';
import { check, unwrap } from './errors';
import { newId } from './ids';
import { channelName } from './realtime';
import { uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type { Database } from '@shared/database.types';

export type { EggWarChoice, EggWarStatus };
export type Snipe = Database['public']['Tables']['egg_war_snipes']['Row'];

export const eggWarKey = (circleId: string) => ['egg-war', circleId] as const;
export const snipesKey = (warId: string | null) => ['egg-war-snipes', warId] as const;

async function fetchEggWar(circleId: string): Promise<EggWarStatus> {
  if (USE_MOCKS) return { members: 4, need: 3, can_start: true, war: null };
  return unwrap(await getSupabase().rpc('egg_war_status', { p_circle_id: circleId })) as unknown as EggWarStatus;
}

/** Status of the coop's egg war (active, else the latest finished one). Live over Realtime. */
export function useEggWar(circleId: string): Query<EggWarStatus> {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!circleId || USE_MOCKS) return;
    const supabase = getSupabase();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: eggWarKey(circleId) });
      void queryClient.invalidateQueries({ queryKey: ['egg-war-snipes'] });
    };
    // egg_war_people has no circle_id to filter on, so listen to all of it (RLS limits rows to my coops).
    const channel = supabase
      .channel(channelName(`egg-war:${circleId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'egg_wars', filter: `circle_id=eq.${circleId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'egg_war_people' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'egg_war_snipes', filter: `circle_id=eq.${circleId}` }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, queryClient]);

  return useQuery<EggWarStatus, Error>({
    queryKey: eggWarKey(circleId),
    enabled: !!circleId,
    // The server resolves countdowns when status is read; re-read every 30s so a vote or war that
    // just ended flips over without anyone touching anything.
    refetchInterval: 30_000,
    queryFn: () => fetchEggWar(circleId),
  });
}

/** War status for every coop on the home screen (the flame badge). Shares useEggWar's cache. */
export function useEggWars(circleIds: string[]): Record<string, EggWarStatus | undefined> {
  const results = useQueries({
    queries: circleIds.map((id) => ({ queryKey: eggWarKey(id), refetchInterval: 60_000, queryFn: () => fetchEggWar(id) })),
  });
  return Object.fromEntries(circleIds.map((id, i) => [id, results[i]?.data]));
}

/** Snipes of a live war, newest first (they're deleted when the war ends). */
export function useEggWarSnipes(warId: string | null): Query<Snipe[]> {
  return useQuery<Snipe[], Error>({
    queryKey: snipesKey(warId),
    enabled: !!warId,
    queryFn: async () => {
      if (USE_MOCKS) return [];
      return unwrap(
        await getSupabase().from('egg_war_snipes').select('*').eq('war_id', warId!).order('created_at', { ascending: false }),
      );
    },
  });
}

function useWarMutation<TVars>(circleId: string, run: (vars: TVars) => Promise<unknown>): Mutation<TVars> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, TVars>({
    mutationFn: async (vars) => {
      if (USE_MOCKS) return;
      await run(vars);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eggWarKey(circleId) });
      void queryClient.invalidateQueries({ queryKey: ['egg-war-snipes'] });
    },
  });
}

export const useStartEggWar = (circleId: string) =>
  useWarMutation<void>(circleId, async () => unwrap(await getSupabase().rpc('start_egg_war', { p_circle_id: circleId })));

export const useVoteEggWar = (circleId: string) =>
  useWarMutation<{ warId: string; choice: EggWarChoice }>(circleId, async ({ warId, choice }) =>
    unwrap(await getSupabase().rpc('vote_egg_war', { p_war_id: warId, p_choice: choice })),
  );

export const useCancelEggWar = (circleId: string) =>
  useWarMutation<{ warId: string }>(circleId, async ({ warId }) => unwrap(await getSupabase().rpc('cancel_egg_war', { p_war_id: warId })));

export const useJoinEggWar = (circleId: string) =>
  useWarMutation<{ warId: string }>(circleId, async ({ warId }) => unwrap(await getSupabase().rpc('join_egg_war', { p_war_id: warId })));

/** Opt out of a live war: nobody can snipe you after this. */
export const useLeaveEggWar = (circleId: string) =>
  useWarMutation<{ warId: string }>(circleId, async ({ warId }) => unwrap(await getSupabase().rpc('leave_egg_war', { p_war_id: warId })));

/** Upload the photo to the coop's folder (as my own file), then post the snipe. */
export const usePostSnipe = (circleId: string) =>
  useWarMutation<{ warId: string; targetId: string; uri: string; caption?: string }>(circleId, async ({ warId, targetId, uri, caption }) => {
    const id = newId();
    const path = mediaPath(circleId, id, 'jpg');
    await uploadFile(path, uri, 'image/jpeg');
    const res = await getSupabase().rpc('post_snipe', {
      p_war_id: warId,
      p_target_id: targetId,
      p_media_path: path,
      p_caption: caption?.trim() || undefined,
      p_id: id,
    });
    if (res.error) await getSupabase().storage.from(MEDIA_BUCKET).remove([path]);
    check(res);
  });

/** The sniper or the person in the photo can take a snipe down. */
export const useDeleteSnipe = (circleId: string) =>
  useWarMutation<{ snipeId: string }>(circleId, async ({ snipeId }) => check(await getSupabase().rpc('delete_snipe', { p_snipe_id: snipeId })));

/** Demo coop only: skip to the end of the countdown / end the war now. */
export const useDemoSkipEggWar = (circleId: string) =>
  useWarMutation<{ warId: string }>(circleId, async ({ warId }) => unwrap(await getSupabase().rpc('demo_skip_egg_war', { p_war_id: warId })));
