import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useMarkNudgeActed, useMyNudges, useSendEgg, type Nudge } from '@/api';
import { Body, Button, Screen } from '@/components';
import { colors, radii, spacing, type } from '@/theme';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return mins < 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

// A4.7 nudges: friendly "reach out to Sam" suggestions, with quick actions.
// Never says why a nudge was sent (plan §9.4): only the message, the friend, and the circle.
export default function NudgesScreen() {
  const nudges = useMyNudges();
  return (
    <Screen title="Nudges" refreshing={nudges.isRefetching} onRefresh={() => void nudges.refetch()}>
      {nudges.isPending ? <Body muted>Loading…</Body> : null}
      {nudges.error ? <Body error>Couldn&apos;t load nudges: {nudges.error.message}</Body> : null}
      {nudges.data?.length === 0 ? <Body muted>No nudges right now. We&apos;ll suggest a friend to check in with now and then.</Body> : null}
      {nudges.data?.map((n) => (
        <NudgeCard key={n.id} nudge={n} />
      ))}
    </Screen>
  );
}

function NudgeCard({ nudge }: { nudge: Nudge }) {
  const sendEgg = useSendEgg();
  const markActed = useMarkNudgeActed();
  const done = !!nudge.actedAt;
  const firstName = nudge.aboutName.split(' ')[0];
  const finish = () => markActed.mutate({ nudgeId: nudge.id });

  return (
    <View style={[styles.card, done && styles.done]}>
      <Text style={styles.message}>{nudge.message}</Text>
      <Text style={styles.meta}>
        {nudge.circleName} · {timeAgo(nudge.sentAt)}
        {done ? ' · ✓ done' : ''}
      </Text>
      {!done ? (
        <>
          <Button
            label={`Send ${firstName} an egg 🥚`}
            onPress={() =>
              sendEgg.mutate({ circleId: nudge.circleId, recipientId: nudge.aboutUserId }, { onSuccess: finish })
            }
            loading={sendEgg.isPending}
          />
          <Button
            variant="secondary"
            label={`Write to ${firstName}`}
            onPress={() => {
              finish();
              router.push(`/circle/${nudge.circleId}/compose?to=${nudge.aboutUserId}`);
            }}
          />
          <Button variant="secondary" label="Already did" onPress={finish} loading={markActed.isPending} />
        </>
      ) : null}
      {sendEgg.error ? <Body error>{sendEgg.error.message}</Body> : null}
      {markActed.error ? <Body error>{markActed.error.message}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  done: { opacity: 0.6 },
  message: { ...type.body, fontWeight: '600', color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },
});
