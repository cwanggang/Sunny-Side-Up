import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localDate, useCoops, useCreateEvent, useMediaUrlMap, usePeople, useSession } from '@/api';
import { afterReply } from '@/dom/defer';
import NewEventPage from '@/dom/NewEventPage';
import { colors } from '@/theme';

// "new event" (the prototype's form, src/dom/NewEventPage.tsx).
export default function NewEventScreen() {
  const { circleId } = useLocalSearchParams<{ circleId?: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coopsQ = useCoops();
  const peopleQ = usePeople();
  const create = useCreateEvent();

  const all = peopleQ.data?.people;
  const urls = useMediaUrlMap([...(all?.values() ?? [])].map((p) => p.avatarPath));
  const people = useMemo(() => {
    const out: Record<string, { id: string; username: string; photoUrl: string | null }> = {};
    all?.forEach((p) => {
      out[p.id] = { id: p.id, username: p.username, photoUrl: p.avatarPath ? (urls[p.avatarPath] ?? null) : null };
    });
    return out;
  }, [all, urls]);
  const coops = useMemo(() => {
    const coopsOf = peopleQ.data?.coopsOf;
    return (coopsQ.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      members: [...(coopsOf?.entries() ?? [])].filter(([id, list]) => id !== myId && list.includes(c.id)).map(([id]) => id),
    }));
  }, [coopsQ.data, peopleQ.data?.coopsOf, myId]);
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDate(d);
  }, []);

  const me = people[myId];
  if (!me || !coopsQ.data) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <NewEventPage
        top={insets.top}
        me={me}
        fixedCoop={circleId ?? null}
        coops={coops}
        people={people}
        defaultDate={defaultDate}
        onBack={async () => afterReply(() => router.back())}
        onSave={async (p) => {
          const [y, m, d] = p.date.split('-').map(Number);
          const [hh, mm] = p.time.split(':').map(Number);
          const e = await create.mutateAsync({
            circleId: p.circleId,
            title: p.title,
            startsAt: new Date(y, m - 1, d, hh, mm),
            location: p.where,
            description: p.desc,
            people: p.people,
            chat: p.chat,
            gallery: p.gallery,
          });
          afterReply(() => router.replace(`/event/${e.id}`));
          return null;
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </KeyboardAvoidingView>
  );
}
