import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eggOf, factsOf, useCoops, useMediaUrl, useMyFullProfile, usePeople, useSession, type Person } from '@/api';
import { afterReply } from '@/dom/defer';
import MemberPage from '@/dom/MemberPage';
import { colors } from '@/theme';

// A friend's egg: crack it, and their profile opens between the halves (src/dom/MemberPage.tsx).
export default function MemberScreen() {
  const { userId, circleId } = useLocalSearchParams<{ userId: string; circleId?: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const isMe = userId === session?.user.id;
  const people = usePeople();
  const mine = useMyFullProfile();
  const coops = useCoops();

  const fromPeople = people.data?.people.get(userId);
  const p = useMemo<Person | undefined>(
    () =>
      fromPeople ??
      (isMe && mine.data
        ? {
            id: mine.data.id,
            name: mine.data.display_name,
            username: mine.data.username,
            avatarPath: mine.data.avatar_path,
            egg: eggOf(mine.data.egg_style),
            facts: factsOf(mine.data.facts),
            birthday: mine.data.birthday,
          }
        : undefined),
    [fromPeople, isMe, mine.data],
  );
  const photo = useMediaUrl(p?.avatarPath ?? null);
  const theirCoops = people.data?.coopsOf.get(userId);
  const mutual = useMemo(
    () => (coops.data ?? []).filter((c) => theirCoops?.includes(c.id)).map((c) => ({ id: c.id, name: c.name })),
    [coops.data, theirCoops],
  );

  const person = useMemo(
    () =>
      p
        ? {
            id: p.id,
            username: p.username,
            name: p.name,
            birthday: p.birthday,
            photoUrl: photo.data ?? null,
            egg: { swatch: p.egg.swatch || 'shell', pattern: !p.egg.pattern || p.egg.pattern === 'none' ? 'plain' : p.egg.pattern },
            facts: p.facts,
          }
        : null,
    [p, photo.data],
  );

  // The page draws once (the egg is mid-crack after that), so wait for everything it shows.
  const ready = !!person && !!coops.data && (!p?.avatarPath || !!photo.data || !!photo.error);
  if (!ready || !person) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MemberPage
        top={insets.top}
        isMe={isMe}
        coopName={circleId ? (coops.data?.find((c) => c.id === circleId)?.name ?? null) : null}
        person={person}
        mutual={mutual}
        onClose={async () => afterReply(() => router.back())}
        onCoop={async (id) => router.push(`/circle/${id}/coop`)}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
