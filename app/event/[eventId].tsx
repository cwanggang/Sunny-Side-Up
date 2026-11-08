import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CHAT_LENGTHS,
  chatClosesAt,
  chatOpen,
  isPast,
  pickPhotos,
  useAddGuestToCoop,
  useAddPhotos,
  useCoop,
  useCoopPeople,
  useEvent,
  useEventMessages,
  useEventPeople,
  useEventPhotos,
  useMediaUrlMap,
  useSendEventMessage,
  useSession,
  useSetChatTimer,
  useSetEventPerson,
  useSetOptOut,
} from '@/api';
import { afterReply } from '@/dom/defer';
import EventPage from '@/dom/EventPage';
import { colors } from '@/theme';

const fail = (e: Error) => Alert.alert('event', e.message.toLowerCase());

// One event: details, temporary chat, people, album (the page is src/dom/EventPage.tsx).
export default function EventScreen() {
  const { eventId, tab } = useLocalSearchParams<{ eventId: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const event = useEvent(eventId);
  const e = event.data;
  const coop = useCoop(e?.circle_id ?? '');
  const coopPeople = useCoopPeople(e?.circle_id ?? '');
  const peopleQ = useEventPeople(eventId);
  const messagesQ = useEventMessages(eventId);
  const photosQ = useEventPhotos(eventId);
  const opt = useSetOptOut();
  const send = useSendEventMessage();
  const timer = useSetChatTimer();
  const setPerson = useSetEventPerson();
  const addGuest = useAddGuestToCoop();
  const addPhotos = useAddPhotos();

  const urls = useMediaUrlMap([...(peopleQ.data ?? []).map((p) => p.avatarPath), ...(photosQ.data ?? []).map((p) => p.media_path)]);
  const people = useMemo(() => {
    const inCoop = new Set((coopPeople.data ?? []).map((p) => p.id));
    return (peopleQ.data ?? []).map((p) => ({
      id: p.userId,
      username: p.username,
      photoUrl: p.avatarPath ? (urls[p.avatarPath] ?? null) : null,
      role: p.role,
      lead: p.isLead,
      out: p.optedOut,
      inCoop: inCoop.has(p.userId),
    }));
  }, [peopleQ.data, coopPeople.data, urls]);
  const messages = useMemo(() => (messagesQ.data ?? []).map((m) => ({ id: m.id, by: m.sender_id, text: m.body })), [messagesQ.data]);
  const photos = useMemo(
    () => (photosQ.data ?? []).map((p) => ({ url: urls[p.media_path] ?? null, ar: p.width && p.height ? p.width / p.height : 1, by: p.author_id })),
    [photosQ.data, urls],
  );

  if (!e) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <EventPage
        top={insets.top}
        me={myId}
        coopName={coop?.name ?? ''}
        title={e.title}
        location={e.location}
        description={e.description}
        startsAt={e.starts_at}
        past={isPast(e)}
        chat={e.chat_enabled}
        chatOpen={chatOpen(e)}
        chatClosesAt={chatClosesAt(e).toISOString()}
        chatDays={e.chat_days_after}
        gallery={e.gallery_enabled}
        people={people}
        messages={messages}
        photos={photos}
        tab={tab ?? 'details'}
        lengths={CHAT_LENGTHS}
        onBack={async () => afterReply(() => router.back())}
        onOpt={async (out) => opt.mutate({ eventId, out }, { onError: fail })}
        onSend={async (body) => {
          await send.mutateAsync({ eventId, body });
        }}
        onTimer={async (days) => timer.mutate({ eventId, days }, { onError: fail })}
        onRole={async (userId, role) => setPerson.mutate({ eventId, userId, role }, { onError: fail })}
        onAddGuest={async (userId) => addGuest.mutate({ eventId, userId }, { onError: fail })}
        onAddPhotos={async () => {
          const picked = await pickPhotos(12);
          if (!picked.length) return null;
          const n = await addPhotos.mutateAsync({ circleId: e.circle_id, eventId, photos: picked });
          return `added ${n} ${n === 1 ? 'photo' : 'photos'}`;
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </KeyboardAvoidingView>
  );
}
