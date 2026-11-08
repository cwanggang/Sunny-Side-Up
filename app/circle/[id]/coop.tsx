import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useCoop, useCoopPeople, useLeaveCoop, useSession } from '@/api';
import { Body, Button, Screen } from '@/components';
import { Carton } from '@/components/Coop';
import { colors, radii, spacing, type } from '@/theme';

// Design v0.4 coop dashboard (Developer B): the egg carton (tap an egg to crack a friend's
// profile; tap the lid for the code), the description, and the coop's pages.
export default function CoopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coop = useCoop(id);
  const people = useCoopPeople(id);
  const leave = useLeaveCoop();

  const nav: { label: string; to: string }[] = [
    { label: 'events', to: `/circle/${id}/events` },
    { label: 'gallery', to: `/circle/${id}/gallery` },
    { label: 'daily', to: `/circle/${id}/daily` },
    { label: "today's photo", to: `/circle/${id}/spotlight` },
    { label: 'sunny sunday', to: `/circle/${id}/sunday` },
    { label: 'birthdays', to: `/circle/${id}/birthdays` },
    { label: 'hangout ideas', to: `/circle/${id}/hangouts` },
    { label: 'feed', to: `/circle/${id}/feed` },
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
          <View key={n.label} style={styles.navItem}>
            <Button variant="secondary" label={n.label} onPress={() => router.push(n.to as never)} />
          </View>
        ))}
        <View style={styles.navItem}>
          <View style={styles.soon}>
            <Text style={styles.soonText}>play! · coming soon</Text>
          </View>
        </View>
      </View>

      <Button
        variant="danger"
        label="leave this coop"
        loading={leave.isPending}
        onPress={() =>
          Alert.alert('leave this coop?', "you can come back with the code.", [
            { text: 'cancel', style: 'cancel' },
            { text: 'leave', style: 'destructive', onPress: () => leave.mutate({ circleId: id }, { onSuccess: () => router.back() }) },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...type.caption, color: colors.textSecondary, textAlign: 'center' },
  desc: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  navItem: { width: '48%' },
  soon: { paddingVertical: spacing.md + 2, borderRadius: radii.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center' },
  soonText: { ...type.body, fontWeight: '600', color: colors.textMuted },
});
