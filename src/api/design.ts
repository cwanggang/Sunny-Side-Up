// Design v0.3 hooks (Developer B, Phase 5 handoff, like demo.ts). Backend: docs/proposals/design-v0.3-backend.md.
//   Daily photo: today's spotlight person posts photos decorated as eggs; everyone else reacts.
//   Sunny Sunday: you send one egg to your secret person; theirs opens only after you send yours.
// Mock mode (EXPO_PUBLIC_USE_MOCKS) returns fixed sample data and no-op mutations.
import { mediaPath, type EggStyle, type SundayStatus } from '@shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { USE_MOCKS } from './config';
import { localDate } from './dates';
import { check, unwrap } from './errors';
import { newId } from './ids';
import { spotlightKey, sundayKey } from './rhythm';
import { uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type { Share } from './types';

export type { EggStyle };

export interface SundayEgg {
  periodKey: string;
  /** Who I send my egg to ("your person"). */
  sendTo: string;
  /** Who sends one to me (same person unless the group has a 3-person ring). */
  fromId: string | null;
  iSent: boolean;
  /** An egg is waiting for me (shown as a gift even before I can open it). */
  theySent: boolean;
  prompt: string;
  mine: Share | null;
  /** Only once I've sent mine. */
  theirs: Share | null;
}

export interface ShareReaction {
  share_id: string;
  user_id: string;
  emoji: string;
}

export const REACTION_EMOJI = ['❤️', '😂', '🥚', '🙌'] as const;

const sundayEggKey = (circleId: string) => ['sunday-egg', circleId] as const;
const reactionsKey = (shareIds: string[]) => ['share-reactions', ...shareIds] as const;

/** Parses shares.egg_style; anything unexpected falls back to a plain shell egg. */
export function eggStyleOf(share: Pick<Share, 'egg_style'> | null | undefined): EggStyle {
  const s = share?.egg_style as Partial<EggStyle> | null | undefined;
  return { swatch: typeof s?.swatch === 'string' ? s.swatch : 'shell', pattern: typeof s?.pattern === 'string' ? s.pattern : 'none' };
}

// ---------- today's prompt ----------

export function useDailyPrompt(): Query<string> {
  const today = localDate();
  return useQuery<string, Error>({
    queryKey: ['daily-prompt', today],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (USE_MOCKS) return 'your shoes, right now';
      return unwrap(await getSupabase().rpc('daily_prompt', { p_day: today })) as string;
    },
  });
}

// ---------- daily photo (spotlight share with egg decoration) ----------

export interface PostDailyPhotoInput {
  circleId: string;
  body: string;
  eggStyle: EggStyle;
  photoUri?: string | null;
}

/** Today's person posts a photo (several a day allowed). The server rejects anyone else. */
export function usePostDailyPhoto(): Mutation<PostDailyPhotoInput> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, PostDailyPhotoInput>({
    mutationFn: async ({ circleId, body, eggStyle, photoUri }) => {
      if (USE_MOCKS) return;
      if (!userId) throw new Error('Not signed in');
      const text = body.trim();
      if (!text && !photoUri) throw new Error('Add a photo or write on your egg.');
      const id = newId();
      let path: string | null = null;
      if (photoUri) {
        path = mediaPath(circleId, id, 'jpg');
        await uploadFile(path, photoUri, 'image/jpeg');
      }
      check(
        await getSupabase().from('shares').insert({
          id,
          circle_id: circleId,
          author_id: userId,
          kind: 'spotlight',
          period_key: localDate(),
          body: text || null,
          egg_style: { ...eggStyle },
          media_path: path,
        }),
      );
    },
    onSuccess: (_, { circleId }) => queryClient.invalidateQueries({ queryKey: spotlightKey(circleId) }),
  });
}

// ---------- reactions on shares ----------

export function useShareReactions(shareIds: string[]): Query<ShareReaction[]> {
  const ids = [...shareIds].sort();
  return useQuery<ShareReaction[], Error>({
    queryKey: reactionsKey(ids),
    enabled: ids.length > 0,
    queryFn: async () => {
      if (USE_MOCKS) return [];
      return unwrap(await getSupabase().from('share_reactions').select('share_id, user_id, emoji').in('share_id', ids));
    },
  });
}

/** Toggles my reaction: adds it, or removes it if I already left that emoji. */
export function useToggleShareReaction(): Mutation<{ shareId: string; emoji: string; on: boolean }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { shareId: string; emoji: string; on: boolean }>({
    mutationFn: async ({ shareId, emoji, on }) => {
      if (USE_MOCKS) return;
      if (!userId) throw new Error('Not signed in');
      const table = getSupabase().from('share_reactions');
      if (on) check(await table.insert({ share_id: shareId, user_id: userId, emoji }));
      else check(await table.delete().eq('share_id', shareId).eq('user_id', userId).eq('emoji', emoji));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['share-reactions'] }),
  });
}

// ---------- Sunny Sunday egg ----------

const MOCK_EGG: SundayEgg = {
  periodKey: '2026-W45',
  sendTo: 'mock-friend',
  fromId: 'mock-friend',
  iSent: false,
  theySent: true,
  prompt: 'what made you think of Jun this week?',
  mine: null,
  theirs: null,
};

/** This week's egg for me in this circle, or null before Sunday's pairs exist. */
export function useSundayEgg(circleId: string): Query<SundayEgg | null> {
  return useQuery<SundayEgg | null, Error>({
    queryKey: sundayEggKey(circleId),
    enabled: !!circleId,
    queryFn: async () => {
      if (USE_MOCKS) return MOCK_EGG;
      const supabase = getSupabase();
      const rows = unwrap(await supabase.rpc('sunday_status', { p_circle_id: circleId })) as SundayStatus[] | null;
      const st = rows?.[0];
      if (!st) return null;
      const ids = [st.my_share_id, st.their_share_id].filter((x): x is string => !!x);
      const shares = ids.length ? unwrap(await supabase.from('shares').select('*').in('id', ids)) : [];
      return {
        periodKey: st.period_key,
        sendTo: st.send_to,
        fromId: st.from_id,
        iSent: st.i_sent,
        theySent: st.they_sent,
        prompt: st.prompt,
        mine: shares.find((s) => s.id === st.my_share_id) ?? null,
        theirs: shares.find((s) => s.id === st.their_share_id) ?? null,
      };
    },
  });
}

export interface SendSundayEggInput {
  circleId: string;
  egg: Pick<SundayEgg, 'periodKey' | 'sendTo'>;
  body: string;
  eggStyle: EggStyle;
  /** A voice memo (.m4a) or a photo (.jpg) from the recorder / picker. */
  mediaUri?: string | null;
}

export function useSendSundayEgg(): Mutation<SendSundayEggInput> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, SendSundayEggInput>({
    mutationFn: async ({ circleId, egg, body, eggStyle, mediaUri }) => {
      if (USE_MOCKS) return;
      if (!userId) throw new Error('Not signed in');
      if (!body.trim() && !mediaUri) throw new Error('Record a voice memo or write on your egg.');
      const id = newId();
      let path: string | null = null;
      if (mediaUri) {
        const voice = mediaUri.toLowerCase().endsWith('.m4a');
        path = mediaPath(circleId, id, voice ? 'm4a' : 'jpg');
        await uploadFile(path, mediaUri, voice ? 'audio/mp4' : 'image/jpeg');
      }
      check(
        await getSupabase().from('shares').insert({
          id,
          circle_id: circleId,
          author_id: userId,
          recipient_id: egg.sendTo,
          kind: 'sunday',
          period_key: egg.periodKey,
          body: body.trim() || null,
          egg_style: { ...eggStyle },
          media_path: path,
        }),
      );
    },
    onSuccess: (_, { circleId }) => {
      queryClient.invalidateQueries({ queryKey: sundayEggKey(circleId) });
      queryClient.invalidateQueries({ queryKey: sundayKey(circleId) });
    },
  });
}
