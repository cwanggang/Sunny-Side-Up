import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useCircleMembers, useFeed, useReact, useSession, type FeedItem } from '@/api';
import { Body, Button, Chip, PhotoThumb, Screen, VoiceMemo } from '@/components';
import { colors, radii, spacing, type } from '@/theme';

const REACTIONS = ['❤️', '😂', '🥚', '🙌'] as const;

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// A2.6 feed: live eggs, texts, photos and voice memos, with reactions.
export default function FeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const feed = useFeed(id);
  const members = useCircleMembers(id);

  const nameOf = (userId: string | null) => {
    if (!userId) return 'everyone';
    if (userId === me) return 'you';
    return members.data?.find((m) => m.userId === userId)?.displayName ?? 'someone';
  };

  return (
    <Screen title="Feed" refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()}>
      <Button label="Send something" onPress={() => router.push(`/circle/${id}/compose`)} />
      {feed.isPending ? <Body muted>Loading…</Body> : null}
      {feed.error ? <Body error>Couldn&apos;t load the feed: {feed.error.message}</Body> : null}
      {feed.data?.length === 0 ? <Body muted>Nothing here yet. Send the first egg!</Body> : null}
      {feed.data?.map((item) => (
        <FeedCard key={item.id} item={item} me={me} nameOf={nameOf} />
      ))}
    </Screen>
  );
}

function FeedCard({ item, me, nameOf }: { item: FeedItem; me?: string; nameOf: (id: string | null) => string }) {
  const react = useReact();
  const sender = nameOf(item.sender_id);
  const from = sender === 'you' ? 'You' : sender;
  const to = item.recipient_id ? ` → ${nameOf(item.recipient_id)}` : '';

  return (
    <View style={styles.card}>
      <Text style={styles.meta}>
        {from}
        {to} · {timeAgo(item.created_at)}
      </Text>

      {item.kind === 'egg' ? <Text style={styles.egg}>🥚</Text> : null}
      {item.kind === 'text' ? <Text style={styles.body}>{item.body}</Text> : null}
      {item.kind === 'photo' ? <PhotoThumb path={item.media_path} /> : null}
      {item.kind === 'voice' ? <VoiceMemo path={item.media_path} /> : null}

      <View style={styles.reactions}>
        {REACTIONS.map((emoji) => {
          const count = item.reactions.filter((r) => r.emoji === emoji).length;
          const mine = item.reactions.some((r) => r.emoji === emoji && r.user_id === me);
          return (
            <Chip
              key={emoji}
              label={count > 0 ? `${emoji} ${count}` : emoji}
              selected={mine}
              disabled={react.isPending}
              onPress={() => react.mutate({ interactionId: item.id, emoji })}
            />
          );
        })}
      </View>
      {react.error ? <Body error>{react.error.message}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { ...type.caption, color: colors.textMuted },
  egg: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.text },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
