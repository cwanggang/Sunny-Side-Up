import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REACTION_EMOJI, eggStyleOf, useCoop, useFeed, usePeople, useReact, useSession, type FeedItem, type Person } from '@/api';
import { Body, PhotoThumb, Screen, VoiceMemo } from '@/components';
import { Avatar, EggButton } from '@/components/Coop';
import { ImageEgg } from '@/components/Egg';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// A2.6 feed, design v0.5 look (A5.2, Developer B): live eggs, texts, photos and voice memos,
// with reactions. Directed items show "→ name" and are only visible to the two of you (P0.13).
export default function FeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const coop = useCoop(id);
  const feed = useFeed(id);
  const people = usePeople();

  const personOf = (userId: string | null) => (userId ? people.data?.people.get(userId) : undefined);
  const nameOf = (userId: string | null) => {
    if (!userId) return 'everyone';
    if (userId === me) return 'you';
    return personOf(userId)?.username ?? 'someone';
  };

  return (
    <Screen title={coop ? `${coop.name} feed` : 'feed'} refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()}>
      <EggButton label="send something" onPress={() => router.push(`/circle/${id}/compose`)} />
      {feed.isPending ? <Body muted>cracking eggs…</Body> : null}
      {feed.error ? <Body error>couldn&apos;t load the feed: {feed.error.message}</Body> : null}
      {feed.data?.length === 0 ? <Body muted>nothing here yet. send the first egg!</Body> : null}
      {feed.data?.map((item) => (
        <FeedCard key={item.id} item={item} me={me} nameOf={nameOf} sender={personOf(item.sender_id)} />
      ))}
    </Screen>
  );
}

function FeedCard({ item, me, nameOf, sender }: { item: FeedItem; me?: string; nameOf: (id: string | null) => string; sender?: Person }) {
  const react = useReact();
  const to = item.recipient_id ? nameOf(item.recipient_id) : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {sender ? <Avatar person={sender} size={34} /> : <View style={styles.avatarGap} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.who}>
            {nameOf(item.sender_id)}
            {to ? <Text style={styles.to}> → {to}</Text> : null}
          </Text>
          <Text style={styles.meta}>{timeAgo(item.created_at)}</Text>
        </View>
        {to ? <Text style={styles.private}>just you two</Text> : null}
      </View>

      {item.kind === 'egg' ? (
        <View style={styles.eggRow}>
          <ImageEgg size={56} swatch={item.egg_style ? eggStyleOf(item).swatch : (sender?.egg.swatch ?? 'shell')} pattern={item.egg_style ? eggStyleOf(item).pattern : (sender?.egg.pattern ?? 'none')} />
          <Text style={styles.eggText}>sent {to ? (to === 'you' ? 'you' : to) : 'everyone'} an egg</Text>
        </View>
      ) : null}
      {item.kind === 'text' ? <Text style={styles.body}>{item.body}</Text> : null}
      {item.kind === 'photo' ? <PhotoThumb path={item.media_path} /> : null}
      {item.kind === 'voice' ? <VoiceMemo path={item.media_path} /> : null}

      <View style={styles.reactions}>
        {REACTION_EMOJI.map((emoji) => {
          const count = item.reactions.filter((r) => r.emoji === emoji).length;
          const mine = item.reactions.some((r) => r.emoji === emoji && r.user_id === me);
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`react ${emoji}`}
              disabled={react.isPending}
              onPress={() => react.mutate({ interactionId: item.id, emoji })}
              style={[styles.reaction, mine && styles.reactionOn]}
            >
              <Text style={styles.reactionText}>
                {emoji}
                {count ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {react.error ? <Body error>{react.error.message}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow.card, gap: spacing.md, padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarGap: { width: 34, height: 34 },
  who: { ...type.body, ...weight('700'), color: colors.text },
  to: { ...weight('600'), color: colors.textSecondary },
  meta: { ...type.caption, color: colors.textMuted },
  private: { ...type.label, color: colors.textSecondary, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, overflow: 'hidden' },
  eggRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eggText: { ...type.heading, color: colors.text },
  body: { ...type.body, fontSize: 17, color: colors.text },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reaction: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: 'transparent' },
  reactionOn: { backgroundColor: colors.primarySoft, borderColor: palette.ink },
  reactionText: { ...type.caption, ...weight('700'), color: colors.text },
});
