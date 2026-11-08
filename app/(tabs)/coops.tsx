import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoops, usePeople, useSession } from '@/api';
import { Body, Button, Screen } from '@/components';
import { Avatar, CoopCard, EggButton } from '@/components/Coop';
import { colors, spacing, type } from '@/theme';

// Design v0.4 "my groups" (Developer B): every coop with its streak and today's status,
// "add a coop" (create new / join with code), and shortcuts to the calendar and your profile.
export default function CoopsScreen() {
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coops = useCoops();
  const people = usePeople();
  const me = myId ? people.data?.people.get(myId) : undefined;
  const nameOf = (id: string | null) =>
    !id ? null : id === myId ? 'you' : (people.data?.people.get(id)?.username ?? 'a friend');

  return (
    <Screen title="my groups" refreshing={coops.isRefetching} onRefresh={() => void coops.refetch()}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="your profile" onPress={() => router.push('/profile')} style={styles.me}>
          {me ? <Avatar person={me} size={40} /> : null}
          <Text style={styles.handle}>@{me?.username ?? '…'}</Text>
        </Pressable>
        <Button variant="secondary" label="calendar" onPress={() => router.push('/calendar')} />
      </View>

      {coops.error ? <Body error>couldn&apos;t load your coops: {coops.error.message}</Body> : null}
      {coops.data?.length === 0 ? (
        <Body muted>no coops yet. make one for your people, or join with a code.</Body>
      ) : null}

      {coops.data?.map((c) => {
        const who = nameOf(c.today_user_id);
        const label = c.today_posted ? "today's photo is in" : who === 'you' ? "it's your day!" : who ? `${who}'s day` : 'no one up today';
        return <CoopCard key={c.id} coop={c} todayLabel={label} onPress={() => router.push(`/circle/${c.id}/coop`)} />;
      })}

      <View style={styles.add}>
        <EggButton label="add a coop" onPress={() => router.push('/coop/new')} />
        <Button variant="secondary" label="join with code" onPress={() => router.push('/coop/join')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  handle: { ...type.heading, color: colors.text },
  add: { gap: spacing.md, marginTop: spacing.md },
});
