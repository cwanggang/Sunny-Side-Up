// Design v0.4 events (Developer B): upcoming + calendar, details, temporary chat (realtime),
// people (leads, roles, guests, opt out), event albums. Backend: 20261108000900_design_v04.sql.
import type { Database } from '@shared/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { USE_MOCKS } from './config';
import { coopsKey, eggOf, type EggLook } from './coops';
import { check, unwrap } from './errors';
import type { Mutation, Query } from './surface';

type Tables = Database['public']['Tables'];
export type EventRow = Tables['events']['Row'];
export type EventMessage = Tables['event_messages']['Row'];
export type EventRole = Database['public']['Enums']['event_role'];
export type EventPhoto = Tables['photos']['Row'];

export interface EventPerson {
  userId: string;
  username: string;
  name: string;
  avatarPath: string | null;
  egg: EggLook;
  role: EventRole;
  isLead: boolean;
  optedOut: boolean;
}

export interface EventSummary extends EventRow {
  people: { user_id: string; role: EventRole; is_lead: boolean; opted_out: boolean }[];
  lastMessageBy: string | null;
}

export const CHAT_LENGTHS: { days: number; label: string }[] = [
  { days: 0, label: 'when the event ends' },
  { days: 1, label: '1 day after the event' },
  { days: 3, label: '3 days after the event' },
  { days: 7, label: '1 week after the event' },
];

/** The chat opens with the event and closes 3 h after it starts + the lead's timer. */
export const chatClosesAt = (e: Pick<EventRow, 'starts_at' | 'chat_days_after'>) =>
  new Date(new Date(e.starts_at).getTime() + 3 * 3600_000 + e.chat_days_after * 86400_000);
export const chatOpen = (e: Pick<EventRow, 'starts_at' | 'chat_days_after' | 'chat_enabled'>) =>
  e.chat_enabled && Date.now() < chatClosesAt(e).getTime();
export const isPast = (e: Pick<EventRow, 'starts_at'>) => new Date(e.starts_at).getTime() + 3 * 3600_000 < Date.now();

const eventsKey = (circleId: string | null) => ['events', circleId ?? 'all'] as const;
const eventKey = (id: string) => ['event', id] as const;

/** All events I can see in one coop (or in all my coops when circleId is null). */
export function useEvents(circleId: string | null): Query<EventSummary[]> {
  const userId = useUserId();
  return useQuery<EventSummary[], Error>({
    queryKey: eventsKey(circleId),
    enabled: !!userId && !USE_MOCKS,
    queryFn: async () => {
      let q = getSupabase()
        .from('events')
        .select('*, event_people(user_id, role, is_lead, opted_out), event_messages(sender_id, created_at)')
        .order('starts_at');
      if (circleId) q = q.eq('circle_id', circleId);
      const rows = unwrap(await q);
      return rows.map(({ event_people, event_messages, ...e }) => {
        const last = [...(event_messages ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        return { ...e, people: event_people ?? [], lastMessageBy: last?.sender_id ?? null };
      });
    },
  });
}

export function useEvent(eventId: string): Query<EventRow> {
  return useQuery<EventRow, Error>({
    queryKey: eventKey(eventId),
    enabled: !!eventId && !USE_MOCKS,
    queryFn: async () => unwrap(await getSupabase().from('events').select('*').eq('id', eventId).single()),
  });
}

export function useEventPeople(eventId: string): Query<EventPerson[]> {
  return useQuery<EventPerson[], Error>({
    queryKey: [...eventKey(eventId), 'people'],
    enabled: !!eventId && !USE_MOCKS,
    queryFn: async () => {
      const supabase = getSupabase();
      const [people, profiles] = await Promise.all([
        supabase.from('event_people').select('*').eq('event_id', eventId).order('added_at'),
        supabase.from('event_profiles').select('*').eq('event_id', eventId),
      ]);
      const prof = new Map(unwrap(profiles).map((p) => [p.id, p]));
      return unwrap(people).map((p) => {
        const pr = prof.get(p.user_id);
        return {
          userId: p.user_id,
          username: pr?.username ?? 'friend',
          name: pr?.display_name || pr?.username || 'friend',
          avatarPath: pr?.avatar_path ?? null,
          egg: eggOf(pr?.egg_style),
          role: p.role,
          isLead: p.is_lead,
          optedOut: p.opted_out,
        };
      });
    },
  });
}

/** The chat, live: new messages arrive over Realtime while the screen is open. */
export function useEventMessages(eventId: string): Query<EventMessage[]> {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!eventId || USE_MOCKS) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`event-chat:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` }, () =>
        queryClient.invalidateQueries({ queryKey: [...eventKey(eventId), 'messages'] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
  return useQuery<EventMessage[], Error>({
    queryKey: [...eventKey(eventId), 'messages'],
    enabled: !!eventId && !USE_MOCKS,
    queryFn: async () =>
      unwrap(await getSupabase().from('event_messages').select('*').eq('event_id', eventId).order('created_at')),
  });
}

export function useSendEventMessage(): Mutation<{ eventId: string; body: string }> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { eventId: string; body: string }>({
    mutationFn: async ({ eventId, body }) => {
      if (!userId) throw new Error('Not signed in');
      const res = await getSupabase().from('event_messages').insert({ event_id: eventId, sender_id: userId, body: body.trim() });
      if (res.error?.code === '42501') throw new Error('this chat is closed, or you opted out');
      check(res);
    },
    onSuccess: (_, { eventId }) => queryClient.invalidateQueries({ queryKey: [...eventKey(eventId), 'messages'] }),
  });
}

export function useEventPhotos(eventId: string): Query<EventPhoto[]> {
  return useQuery<EventPhoto[], Error>({
    queryKey: ['event-photos', eventId],
    enabled: !!eventId && !USE_MOCKS,
    queryFn: async () =>
      unwrap(await getSupabase().from('photos').select('*').eq('event_id', eventId).order('created_at', { ascending: false })),
  });
}

/** Photo counts for event albums (gallery page). */
export function useAlbumCounts(circleId: string): Query<Map<string, { count: number; cover: string }>> {
  return useQuery({
    queryKey: ['albums', circleId],
    enabled: !!circleId && !USE_MOCKS,
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase().from('photos').select('event_id, media_path').eq('circle_id', circleId).not('event_id', 'is', null)
          .order('created_at', { ascending: false }),
      );
      const m = new Map<string, { count: number; cover: string }>();
      for (const r of rows) {
        if (!r.event_id) continue;
        const cur = m.get(r.event_id);
        m.set(r.event_id, { count: (cur?.count ?? 0) + 1, cover: cur?.cover ?? r.media_path });
      }
      return m;
    },
  });
}

// ---------- actions ----------

function useInvalidateEvent() {
  const queryClient = useQueryClient();
  return (eventId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    if (eventId) queryClient.invalidateQueries({ queryKey: eventKey(eventId) });
  };
}

export interface NewEventInput {
  circleId: string;
  title: string;
  startsAt: Date;
  location?: string;
  description?: string;
  people: { userId: string; role: EventRole; lead?: boolean }[];
  chat: boolean;
  gallery: boolean;
}

export function useCreateEvent(): Mutation<NewEventInput, EventRow> {
  const invalidate = useInvalidateEvent();
  return useMutation<EventRow, Error, NewEventInput>({
    mutationFn: async (i) =>
      unwrap(
        await getSupabase().rpc('create_event', {
          p_circle_id: i.circleId,
          p_title: i.title,
          p_starts_at: i.startsAt.toISOString(),
          p_location: i.location || undefined,
          p_description: i.description || undefined,
          p_people: i.people.map((p) => ({ user_id: p.userId, role: p.role, lead: !!p.lead })),
          p_chat_enabled: i.chat,
          p_gallery_enabled: i.gallery,
        }),
      ) as EventRow,
    onSuccess: (e) => invalidate(e.id),
  });
}

export function useSetOptOut(): Mutation<{ eventId: string; out: boolean }> {
  const invalidate = useInvalidateEvent();
  return useMutation<void, Error, { eventId: string; out: boolean }>({
    mutationFn: async ({ eventId, out }) => check(await getSupabase().rpc('set_event_opt_out', { p_event_id: eventId, p_out: out })),
    onSuccess: (_, { eventId }) => invalidate(eventId),
  });
}

export function useSetChatTimer(): Mutation<{ eventId: string; days: number }> {
  const invalidate = useInvalidateEvent();
  return useMutation<void, Error, { eventId: string; days: number }>({
    mutationFn: async ({ eventId, days }) =>
      check(await getSupabase().rpc('set_event_chat_timer', { p_event_id: eventId, p_days: days })),
    onSuccess: (_, { eventId }) => invalidate(eventId),
  });
}

export function useSetEventPerson(): Mutation<{ eventId: string; userId: string; role?: EventRole; lead?: boolean; remove?: boolean }> {
  const invalidate = useInvalidateEvent();
  return useMutation<void, Error, { eventId: string; userId: string; role?: EventRole; lead?: boolean; remove?: boolean }>({
    mutationFn: async ({ eventId, userId, role, lead, remove }) =>
      check(
        await getSupabase().rpc('set_event_person', {
          p_event_id: eventId, p_user_id: userId, p_role: role, p_lead: lead, p_remove: remove ?? false,
        }),
      ),
    onSuccess: (_, { eventId }) => invalidate(eventId),
  });
}

export function useAddGuestToCoop(): Mutation<{ eventId: string; userId: string }> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { eventId: string; userId: string }>({
    mutationFn: async ({ eventId, userId }) =>
      check(await getSupabase().rpc('add_event_guest_to_circle', { p_event_id: eventId, p_user_id: userId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: coopsKey });
    },
  });
}
