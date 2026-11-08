import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useCoop, useCoopPeople, useDaily, useSession } from '@/api';
import { Body, Button, Card, Egg, PhotoThumb, Screen } from '@/components';
import { Avatar } from '@/components/Coop';
import { colors, radii, spacing, type, weight } from '@/theme';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Design v0.4 "daily" (Developer B): the streak, and the last seven days' photos with their prompts.
export default function DailyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coop = useCoop(id);
  const daily = useDaily(id);
  const people = useCoopPeople(id);
  const byId = new Map((people.data ?? []).map((p) => [p.id, p]));
  const name = (uid: string | null) => (!uid ? 'someone' : uid === myId ? 'you' : (byId.get(uid)?.username ?? 'a friend'));

  const today = daily.data?.[0];
  const streak = coop?.streak ?? 0;
  const keep = today?.posted
    ? 'today is in. see you tomorrow!'
    : today?.user_id === myId
      ? "it's your day. post today to keep it going"
      : `${name(today?.user_id ?? null)} posts today to keep it going`;

  return (
    <Screen title={coop ? `${coop.name} · daily` : 'daily'} refreshing={daily.isRefetching} onRefresh={() => void daily.refetch()}>
      <Card tone="yolk">
        <View style={styles.banner}>
          <Egg size={40} swatch="butter" pattern="none" />
          <View style={{ flex: 1 }}>
            <Text style={styles.streak}>
              {streak} {streak === 1 ? 'day' : 'days'} in a row
            </Text>
            <Text style={styles.keep}>{keep}</Text>
          </View>
        </View>
      </Card>

      {daily.error ? <Body error>{daily.error.message}</Body> : null}
      {daily.data?.map((d, i) => {
        const date = new Date(`${d.day}T12:00:00`);
        const label = i === 0 ? 'today' : i === 1 ? 'yesterday' : DAYS[date.getDay()];
        const who = d.user_id ? byId.get(d.user_id) : undefined;
        return (
          <Card key={d.day}>
            <View style={styles.head}>
              <Text style={styles.day}>{label}</Text>
              <Text style={styles.date}>
                {MON[date.getMonth()]} {date.getDate()}
              </Text>
            </View>
            <View style={styles.photo}>
              {d.posted && d.media_path ? (
                <PhotoThumb path={d.media_path} size={280} />
              ) : d.posted ? (
                <Egg size={80} swatch="butter" pattern="dots" text="posted!" />
              ) : i === 0 ? (
                d.user_id === myId ? (
                  <Button label="add today's photo" onPress={() => router.push(`/circle/${id}/spotlight`)} />
                ) : (
                  <Text style={styles.empty}>🥚 waiting on {name(d.user_id)}</Text>
                )
              ) : (
                <Text style={styles.empty}>no photo this day</Text>
              )}
            </View>
            {d.posted && who ? (
              <View style={styles.by}>
                <Avatar person={who} size={24} />
                <Text style={styles.byName}>{name(d.user_id)}</Text>
                {d.posted_at ? <Text style={styles.date}>{new Date(d.posted_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</Text> : null}
              </View>
            ) : null}
            <Text style={styles.prompt}>{d.prompt}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streak: { ...type.title, color: colors.text },
  keep: { ...type.caption, color: colors.textSecondary },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  day: { ...type.heading, color: colors.text },
  date: { ...type.caption, color: colors.textMuted },
  photo: { minHeight: 120, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, backgroundColor: colors.surfaceAlt, padding: spacing.sm },
  empty: { ...type.body, color: colors.textMuted },
  by: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  byName: { ...type.body, ...weight('700'), color: colors.text },
  prompt: { ...type.caption, fontStyle: 'italic', color: colors.textSecondary },
});
