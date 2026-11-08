// The nudge chick (prototype flow 11). It brings two things to the home screen:
//   1. a nudge: the newest row from `my_nudges` I haven't acted on or waved away. Only the friend's name
//      and the server's neutral `message` are used. The view hides reason_kind, so the chick can't tell
//      (and never says) why a friend was picked (plan §9.4). The prototype's made-up "why" numbers are
//      deliberately not ported.
//   2. a delivery: a friend's egg (a directed egg / photo / voice memo in `interactions`) that arrived in
//      the last day and hasn't been opened yet.
// Whether the chick is on, and what's been opened or waved away, stays in a small file on this phone.
import { MEDIA_BUCKET, mediaPath } from '@shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { useEffect, useMemo } from 'react';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { USE_MOCKS } from './config';
import { check, unwrap } from './errors';
import { feedKey } from './feed';
import { newId } from './ids';
import { nudgesKey, useMyNudges } from './nudges';
import { channelName } from './realtime';
import { uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type { Interaction, Nudge } from './types';

export interface ChickPrefs {
  /** "chick nudges" in settings. Off: friends' eggs come as notifications only. */
  on: boolean;
  /** Nudges waved away ("not now", shooed). */
  dismissed: string[];
  /** Friends' eggs already opened. */
  opened: string[];
}
const DEFAULTS: ChickPrefs = { on: true, dismissed: [], opened: [] };
const KEEP = 60;
const NUDGE_DAYS = 3;
const MAIL_HOURS = 24;

const prefsKey = ['chick-prefs'] as const;
const mailKey = (userId: string | null) => ['chick-mail', userId] as const;
const file = () => new File(Paths.document, 'chick.json');

async function readPrefs(): Promise<ChickPrefs> {
  try {
    const f = file();
    if (!f.exists) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(await f.text()) as Partial<ChickPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function useChickPrefs(): Query<ChickPrefs> {
  return useQuery<ChickPrefs, Error>({ queryKey: prefsKey, queryFn: readPrefs, staleTime: Infinity });
}

export function useSetChickPrefs(): Mutation<Partial<ChickPrefs>> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, Partial<ChickPrefs>>({
    mutationFn: async (patch) => {
      const next = { ...(await readPrefs()), ...patch };
      next.dismissed = next.dismissed.slice(-KEEP);
      next.opened = next.opened.slice(-KEEP);
      const f = file();
      if (!f.exists) f.create();
      await f.write(JSON.stringify(next));
      queryClient.setQueryData(prefsKey, next);
    },
  });
}

const isRecent = (iso: string) => Date.parse(iso) > Date.now() - NUDGE_DAYS * 86400_000;

/** The nudge the chick should bring now, and the newest one at all (the demo's "call the chick"). */
export function useChickNudge(): { current: Nudge | null; latest: Nudge | null; refetch: () => void } {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const nudges = useMyNudges();
  const prefs = useChickPrefs();

  // Nudges arrive as `notifications` rows (Realtime doesn't work on the my_nudges view).
  useEffect(() => {
    if (!userId || USE_MOCKS) return;
    const supabase = getSupabase();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: nudgesKey(userId) });
    const channel = supabase
      .channel(channelName(`chick-nudges:${userId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        if ((payload.new as { type?: string }).type === 'nudge') refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useMemo(() => {
    const list = nudges.data ?? [];
    const dismissed = prefs.data?.dismissed ?? [];
    const current = list.find((n) => !n.actedAt && !dismissed.includes(n.id) && isRecent(n.sentAt)) ?? null;
    return { current, latest: list[0] ?? null, refetch: () => void nudges.refetch() };
  }, [nudges, prefs.data?.dismissed]);
}

/** Friends' eggs waiting for me (newest first), live over Realtime. */
export function useChickMail(): Interaction[] {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const prefs = useChickPrefs();

  useEffect(() => {
    if (!userId || USE_MOCKS) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(channelName(`chick-mail:${userId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interactions', filter: `recipient_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: mailKey(userId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const mail = useQuery<Interaction[], Error>({
    queryKey: mailKey(userId),
    enabled: !!userId && !USE_MOCKS,
    refetchOnMount: 'always',
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('interactions')
          .select('*')
          .eq('recipient_id', userId!)
          .in('kind', ['egg', 'photo', 'voice'])
          .gte('created_at', new Date(Date.now() - MAIL_HOURS * 3600_000).toISOString())
          .order('created_at', { ascending: false }),
      ),
  });

  const opened = prefs.data?.opened;
  return useMemo(() => (mail.data ?? []).filter((m) => !opened?.includes(m.id)), [mail.data, opened]);
}

/** One friend's egg, for the reveal screen. */
export function useFriendEgg(id: string): Query<Interaction> {
  return useQuery<Interaction, Error>({
    queryKey: ['friend-egg', id],
    enabled: !!id && !USE_MOCKS,
    queryFn: async () => unwrap(await getSupabase().from('interactions').select('*').eq('id', id).single()),
  });
}

/** Marks a friend's egg opened, so the chick stops bringing it. */
export function useOpenChickEgg(): (id: string) => void {
  const set = useSetChickPrefs();
  const prefs = useChickPrefs();
  return (id) => set.mutate({ opened: [...(prefs.data?.opened ?? []), id] });
}

export interface ChickEgg {
  circleId: string;
  recipientId: string;
  /** What's written on the egg. */
  body: string;
  /** A voice memo (.m4a) or a photo (.jpg). */
  mediaUri?: string | null;
  /** Marks this nudge as acted on. */
  nudgeId?: string | null;
  /** The decoration from the decorate screen, so the friend gets the egg as it was decorated. */
  eggStyle?: { swatch: string; pattern: string } | null;
}

/** Sends a just-because egg to one friend: a directed interaction, so only the two of you see it (P0.13). */
export function useSendChickEgg(): Mutation<ChickEgg> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, ChickEgg>({
    mutationFn: async ({ circleId, recipientId, body, mediaUri, nudgeId, eggStyle }) => {
      if (!userId) throw new Error('Not signed in');
      const supabase = getSupabase();
      const id = newId();
      const voice = !!mediaUri && mediaUri.toLowerCase().endsWith('.m4a');
      let path: string | null = null;
      if (mediaUri) {
        path = mediaPath(circleId, id, voice ? 'm4a' : 'jpg');
        await uploadFile(path, mediaUri, voice ? 'audio/mp4' : 'image/jpeg');
      }
      const res = await supabase.from('interactions').insert({
        id,
        circle_id: circleId,
        sender_id: userId,
        recipient_id: recipientId,
        kind: mediaUri ? (voice ? 'voice' : 'photo') : 'egg',
        body: body.trim() || null,
        media_path: path,
        egg_style: eggStyle ? { swatch: eggStyle.swatch, pattern: eggStyle.pattern } : null,
      });
      if (res.error && path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      check(res);
      if (nudgeId) check(await supabase.from('my_nudges').update({ acted_at: new Date().toISOString() }).eq('id', nudgeId));
    },
    onSuccess: (_, { circleId }) => {
      void queryClient.invalidateQueries({ queryKey: feedKey(circleId) });
      void queryClient.invalidateQueries({ queryKey: nudgesKey(userId) });
    },
  });
}

// The egg the chick should carry off the next time home is on screen (set by the decorate screen).
export interface PendingCarry {
  id: string;
  to: string;
  egg: { swatch: string; pattern: string };
}
let pendingCarry: PendingCarry | null = null;
export const setPendingCarry = (c: PendingCarry | null) => {
  pendingCarry = c;
};
export const getPendingCarry = () => pendingCarry;
