import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoop, useCoopPeople, useLeaveCoop, useSession } from '@/api';
import { Body, Button, Screen } from '@/components';
import { Carton } from '@/components/Coop';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

// Design v0.4 coop dashboard (Developer B): the egg carton (tap an egg to crack a friend's
// profile; tap the lid for the code), the description, and the coop's pages.
export default function CoopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coop = useCoop(id);
  const people = useCoopPeople(id);
  const leave = useLeaveCoop();

  const nav: { icon: string; label: string; to: string }[] = [
    { icon: '📸', label: "today's photo", to: `/circle/${id}/spotlight` },
    { icon: '💬', label: 'feed', to: `/circle/${id}/feed` },
    { icon: '🥚', label: 'send something', to: `/circle/${id}/compose` },
    { icon: '☀️', label: 'sunny sunday', to: `/circle/${id}/sunday` },
    { icon: '📅', label: 'events', to: `/circle/${id}/events` },
    { icon: '🖼️', label: 'gallery', to: `/circle/${id}/gallery` },
    { icon: '🔥', label: 'daily', to: `/circle/${id}/daily` },
    { icon: '🎂', label: 'birthdays', to: `/circle/${id}/birthdays` },
    { icon: '✨', label: 'hangout ideas', to: `/circle/${id}/hangouts` },
  ];

  return (
    <Screen title={coop?.name ?? 'coop'} refreshing={people.isRefetching} onRefresh={() => void people.refetch()}>
      <Text style={styles.kicker}>
        {coop ? `${coop.members} ${coop.members === 1 ? 'egg' : 'eggs'} in this coop · 🥚 ${coop.streak} day streak` : ' '}
      </Text>
      {people.error ? <Body error>{people.error.message}</Body> : null}
      {coop && people.data ? (
        <Carton
          coop={coop}
          members={people.data}
          myId={myId}
          onMember={(p) => router.push(`/member/${p.id}?circleId=${id}`)}
        />
      ) : null}
      {coop?.description ? <Text style={styles.desc}>{coop.description}</Text> : null}

      <View style={styles.nav}>
        {nav.map((n) => (
          <Pressable
            key={n.label}
            accessibilityRole="button"
            onPress={() => router.push(n.to as never)}
            style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Text style={styles.tileIcon}>{n.icon}</Text>
            <Text style={styles.tileText}>{n.label}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        variant="danger"
        label="leave this coop"
        loading={leave.isPending}
        onPress={() =>
          Alert.alert('leave this coop?', "you can come back with the code.", [
            { text: 'cancel', style: 'cancel' },
            { text: 'leave', style: 'destructive', onPress: () => leave.mutate({ circleId: id }, { onSuccess: () => router.replace('/circles') }) },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...type.caption, color: colors.textSecondary, textAlign: 'center' },
  desc: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  tile: { ...shadow.card, width: '31.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  tileIcon: { fontSize: 28 },
  tileText: { ...type.caption, ...weight('700'), color: colors.text, textAlign: 'center' },
});
