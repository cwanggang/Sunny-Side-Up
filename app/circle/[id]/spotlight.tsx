import { router, useLocalSearchParams } from 'expo-router';

import { useCircleMembers, useSession, useSpotlight } from '@/api';
import { Body, Button, Heading, ListItem, Screen, ShareComposer, SharePost } from '@/components';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// A3.5 spotlight: today's person (they share, everyone else shows them some love) + this week's schedule.
export default function SpotlightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const spotlight = useSpotlight(id);
  const members = useCircleMembers(id);
  const nameOf = (userId: string) =>
    userId === session?.user.id ? 'You' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'Friend');
  const today = spotlight.data?.today ?? null;
  const isMe = !!today && today.userId === session?.user.id;

  return (
    <Screen title="Spotlight" refreshing={spotlight.isRefetching} onRefresh={() => void spotlight.refetch()}>
      {spotlight.isPending ? <Body muted>Loading…</Body> : null}
      {spotlight.error ? <Body error>Couldn&apos;t load the spotlight: {spotlight.error.message}</Body> : null}

      {spotlight.data ? (
        <>
          <Heading>{today ? (isMe ? "Today's your spotlight day ☀️" : `Today's spotlight: ${today.displayName} ☀️`) : 'No spotlight today'}</Heading>

          {isMe ? (
            <>
              <Body muted>Share what you&apos;re up to today. Your circle will see it here.</Body>
              <ShareComposer circleId={id} kind="spotlight" placeholder="Today I'm…" />
            </>
          ) : today ? (
            <Button
              label={`Send ${today.displayName} something`}
              onPress={() => router.push(`/circle/${id}/compose?to=${today.userId}`)}
            />
          ) : (
            <Body muted>The schedule fills in a week ahead.</Body>
          )}

          {spotlight.data.posts.map((p) => (
            <SharePost key={p.id} share={p} author={nameOf(p.author_id)} />
          ))}

          <Heading>This week</Heading>
          {spotlight.data.week.length === 0 ? <Body muted>Nobody is scheduled yet.</Body> : null}
          {spotlight.data.week.map((d) => (
            <ListItem
              key={d.day}
              title={d.userId === session?.user.id ? `${d.displayName} (you)` : d.displayName}
              subtitle={d.day === today?.day ? 'Today' : dayLabel(d.day)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
