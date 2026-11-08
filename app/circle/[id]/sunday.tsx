import { useLocalSearchParams } from 'expo-router';

import { useCircleMembers, useSession, useSundayShare } from '@/api';
import { Body, Heading, Screen, ShareComposer, SharePost } from '@/components';

// A3.5 Sunday share: this week's prompt, post, and everyone's posts (last week's too).
export default function SundayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const sunday = useSundayShare(id);
  const members = useCircleMembers(id);
  const nameOf = (userId: string) =>
    userId === session?.user.id ? 'You' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'Friend');

  const data = sunday.data;

  return (
    <Screen title="Sunday share" refreshing={sunday.isRefetching} onRefresh={() => void sunday.refetch()}>
      <Body muted>
        {data?.isOpen
          ? "Sunday share is open ☀️ How was your week?"
          : 'Sunday share opens on Sunday. You can post early: anything this week counts toward it.'}
      </Body>
      <ShareComposer circleId={id} kind="sunday" placeholder="Best part of my week was…" />

      {sunday.isPending ? <Body muted>Loading…</Body> : null}
      {sunday.error ? <Body error>Couldn&apos;t load shares: {sunday.error.message}</Body> : null}

      {data ? (
        <>
          <Heading>This week</Heading>
          {data.posts.length === 0 ? <Body muted>No shares yet. Be the first!</Body> : null}
          {data.posts.map((p) => (
            <SharePost key={p.id} share={p} author={nameOf(p.author_id)} />
          ))}

          {data.previousPosts.length > 0 ? (
            <>
              <Heading>Last week</Heading>
              {data.previousPosts.map((p) => (
                <SharePost key={p.id} share={p} author={nameOf(p.author_id)} />
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
