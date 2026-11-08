import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { eggStyleOf, useCircleMembers, useDailyPrompt, useSession, useSpotlight, type Share } from '@/api';
import { Body, Button, Card, Egg, Label, PhotoThumb, ReactionBar, Screen } from '@/components';
import { colors, spacing, type, weight } from '@/theme';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();

// "today's photo": one person a day posts photos for today's prompt, decorated as an egg; everyone
// else reacts. Posting goes through the same pick -> camera or your photos -> decorate -> deliver flow
// as sunny sunday (respond?daily=1). Only today's person can post (server-enforced).
export default function SpotlightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const spotlight = useSpotlight(id);
  const prompt = useDailyPrompt();
  const members = useCircleMembers(id);
  const nameOf = (userId: string) =>
    userId === myId ? 'you' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'friend').toLowerCase();
  const today = spotlight.data?.today ?? null;
  const isMe = !!today && today.userId === myId;
  const posts = spotlight.data?.posts ?? [];
  // your own photos aren't listed here (they're on home and in daily); friends' are, to react to
  const theirs = posts.filter((p) => p.author_id !== myId);
  const postedToday = posts.some((p) => p.author_id === myId);

  return (
    <Screen title="today's photo" refreshing={spotlight.isRefetching} onRefresh={() => void spotlight.refetch()}>
      {spotlight.error ? <Body error>couldn&apos;t load today: {spotlight.error.message}</Body> : null}

      <Card tone="yolk">
        <Label>today&apos;s prompt</Label>
        <Text style={styles.prompt}>{prompt.data ?? '…'}</Text>
        <Text style={styles.whose}>
          {today ? (isMe ? "it's your day!" : `it's ${nameOf(today.userId)}'s day`) : 'no one is up today'}
        </Text>
      </Card>

      {isMe ? (
        <Button
          label={postedToday ? 'send another photo' : "send today's photo"}
          onPress={() => router.push(`/circle/${id}/respond?daily=1`)}
        />
      ) : null}
      {isMe && postedToday ? <Body muted>yours is up. your coop can react to it now.</Body> : null}

      {theirs.length === 0 && today && !isMe ? (
        <Card>
          <View style={styles.center}>
            <Egg size={70} />
            <Body muted>waiting on {nameOf(today.userId)} · any minute now</Body>
          </View>
        </Card>
      ) : null}

      {[...theirs].reverse().map((p) => (
        <PhotoPost key={p.id} share={p} author={nameOf(p.author_id)} myId={myId} />
      ))}
    </Screen>
  );
}

function PhotoPost({ share, author, myId }: { share: Share; author: string; myId: string | null }) {
  const style = eggStyleOf(share);
  return (
    <Card>
      {share.media_path ? (
        <View style={styles.photoWrap}>
          <PhotoThumb path={share.media_path} size={300} />
        </View>
      ) : null}
      <View style={styles.byline}>
        <Egg size={36} swatch={style.swatch} pattern={style.pattern} />
        <View style={styles.flex}>
          <Text style={styles.author}>{author}</Text>
          <Text style={styles.time}>{timeOf(share.created_at)}</Text>
        </View>
      </View>
      {share.body ? <Text style={styles.body}>{share.body}</Text> : null}
      <ReactionBar shareId={share.id} myUserId={myId} isMine={share.author_id === myId} />
    </Card>
  );
}

const styles = StyleSheet.create({
  prompt: { ...type.title, color: colors.text },
  whose: { ...type.body, ...weight('700'), color: colors.primaryDeep },
  center: { alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  photoWrap: { alignItems: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  author: { ...type.heading, color: colors.text },
  time: { ...type.caption, color: colors.textMuted },
  body: { ...type.body, color: colors.text },
});
