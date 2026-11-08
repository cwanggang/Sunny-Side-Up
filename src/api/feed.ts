// A2.1–A2.4: a circle's feed (live over Realtime), sending eggs / texts / photos / voice memos,
// and reactions. Visibility is enforced by RLS (P0.13): the feed returns whole-circle items plus
// my own directed items (ones I sent or received).
import { MEDIA_BUCKET, mediaPath } from '@shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { check, unwrap } from './errors';
import { newId } from './ids';
import { uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type { FeedItem, InteractionKind, SendTarget } from './types';

const FEED_LIMIT = 100;
export const MAX_TEXT_LENGTH = 500;

export const feedKey = (circleId: string) => ['feed', circleId] as const;

/** Newest first. Refetches whenever an interaction or reaction in this circle changes. */
export function useFeed(circleId: string): Query<FeedItem[]> {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!circleId) return;
    const supabase = getSupabase();
    const refresh = () => queryClient.invalidateQueries({ queryKey: feedKey(circleId) });
    const inThisFeed = (interactionId: unknown) =>
      !!queryClient.getQueryData<FeedItem[]>(feedKey(circleId))?.some((i) => i.id === interactionId);

    // RLS applies to Realtime too, so only interactions I'm allowed to see arrive here.
    const channel = supabase
      .channel(`feed:${circleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interactions', filter: `circle_id=eq.${circleId}` },
        refresh,
      )
      // reactions has no circle_id to filter on; ignore ones for items not in this feed.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { interaction_id?: string };
        if (inThisFeed(row.interaction_id)) refresh();
      })
      .subscribe((status) => {
        // Catch up on anything missed while the socket was down (e.g. app was in the background).
        if (status === 'SUBSCRIBED') refresh();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, queryClient]);

  return useQuery<FeedItem[], Error>({
    queryKey: feedKey(circleId),
    enabled: !!circleId,
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('interactions')
          .select('*, reactions(*)')
          .eq('circle_id', circleId)
          .order('created_at', { ascending: false })
          .limit(FEED_LIMIT),
      ),
  });
}

interface NewInteraction extends SendTarget {
  kind: InteractionKind;
  body?: string | null;
  /** Local file to upload first (photo: jpg, voice: m4a). */
  file?: { uri: string; ext: 'jpg' | 'm4a'; contentType: string };
}

function useSend<TVars>(toInteraction: (vars: TVars) => NewInteraction): Mutation<TVars> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, TVars>({
    mutationFn: async (vars) => {
      if (!userId) throw new Error('Not signed in');
      const { circleId, recipientId, kind, body, file } = toInteraction(vars);
      const id = newId();
      let path: string | null = null;
      if (file) {
        path = mediaPath(circleId, id, file.ext);
        await uploadFile(path, file.uri, file.contentType);
      }
      const result = await getSupabase()
        .from('interactions')
        .insert({
          id,
          circle_id: circleId,
          sender_id: userId,
          recipient_id: recipientId ?? null,
          kind,
          body: body ?? null,
          media_path: path,
        });
      if (result.error && path) {
        // Don't leave an orphaned file behind if the row couldn't be created.
        await getSupabase().storage.from(MEDIA_BUCKET).remove([path]);
      }
      check(result);
    },
    onSuccess: (_, vars) =>
      queryClient.invalidateQueries({ queryKey: feedKey(toInteraction(vars).circleId) }),
  });
}

export const useSendEgg = (): Mutation<SendTarget> => useSend((t: SendTarget) => ({ ...t, kind: 'egg' }));

export const useSendText = (): Mutation<SendTarget & { body: string }> =>
  useSend(({ body, ...t }: SendTarget & { body: string }) => {
    const text = body.trim();
    if (!text) throw new Error('Write something first.');
    if (text.length > MAX_TEXT_LENGTH) throw new Error(`Keep it under ${MAX_TEXT_LENGTH} characters.`);
    return { ...t, kind: 'text', body: text };
  });

export const useSendPhoto = (): Mutation<SendTarget & { uri: string }> =>
  useSend(({ uri, ...t }: SendTarget & { uri: string }) => ({
    ...t,
    kind: 'photo',
    file: { uri, ext: 'jpg', contentType: 'image/jpeg' },
  }));

/** `durationMs` isn't stored (no column); the player reads the length from the file. */
export const useSendVoice = (): Mutation<SendTarget & { uri: string; durationMs: number }> =>
  useSend(({ uri, durationMs: _durationMs, ...t }: SendTarget & { uri: string; durationMs: number }) => ({
    ...t,
    kind: 'voice',
    file: { uri, ext: 'm4a', contentType: 'audio/mp4' },
  }));

/** Toggles my reaction: removes it if I already reacted with this emoji, adds it otherwise. */
export function useReact(): Mutation<{ interactionId: string; emoji: string }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { interactionId: string; emoji: string }>({
    mutationFn: async ({ interactionId, emoji }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const match = { interaction_id: interactionId, user_id: userId, emoji };
      const removed = unwrap(await supabase.from('reactions').delete().match(match).select('emoji'));
      if (removed.length === 0) check(await supabase.from('reactions').insert(match));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}
