import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chatOpen, isPast, useCoops, useEvents, useSession, useSetOptOut } from '@/api';
import { afterReply } from '@/dom/defer';
import EventsPage from '@/dom/EventsPage';
import { colors } from '@/theme';

/** The events page of one coop, or the calendar across all of them (`circleId` null). */
export function EventsScreen({ circleId }: { circleId: string | null }) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coops = useCoops();
  const q = useEvents(circleId);
  const opt = useSetOptOut();

  const coopNames = useMemo(() => Object.fromEntries((coops.data ?? []).map((c) => [c.id, c.name])), [coops.data]);
  const events = useMemo(
    () =>
      (q.data ?? []).map((e) => ({
        id: e.id,
        circleId: e.circle_id,
        title: e.title,
        location: e.location,
        startsAt: e.starts_at,
        past: isPast(e),
        chat: e.chat_enabled,
        chatOpen: chatOpen(e),
        gallery: e.gallery_enabled,
        // Not on the event at all counts as out: the button says "join" (the server adds you).
        invited: e.people.some((p) => p.user_id === myId),
        out: !e.people.some((p) => p.user_id === myId && !p.opted_out),
        going: e.people.filter((p) => !p.opted_out).length,
        unread: !!e.lastMessageBy && e.lastMessageBy !== myId,
      })),
    [q.data, myId],
  );
  const coop = circleId ? coopNames[circleId] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EventsPage
        top={insets.top}
        title={coop ?? 'calendar'}
        sub={circleId ? 'events' : 'all your coops'}
        coopId={circleId}
        coopNames={coopNames}
        events={events}
        onBack={async () => afterReply(() => router.back())}
        onOpen={async (id, tab) => router.push(`/event/${id}?tab=${tab}`)}
        onOpt={async (id, out) => opt.mutate({ eventId: id, out }, { onError: (e) => Alert.alert('events', e.message.toLowerCase()) })}
        onNew={async () => router.push(circleId ? `/event/new?circleId=${circleId}` : '/event/new')}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
