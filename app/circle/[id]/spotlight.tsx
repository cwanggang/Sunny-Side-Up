import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  eggStyleOf,
  useCameraCapture,
  useCircleMembers,
  useDailyPrompt,
  usePhotoPicker,
  usePostDailyPhoto,
  useSession,
  useSpotlight,
  type Share,
} from '@/api';
import { Body, Button, Card, Egg, EggStylePicker, Label, PhotoThumb, ReactionBar, Screen, TextField } from '@/components';
import { colors, radii, spacing, type, weight } from '@/theme';

const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase();
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();

// Design v0.3 "today's photo" (B5.2 handoff): one person a day posts photos for today's prompt,
// decorated as an egg; everyone else reacts. Only today's person can post (server-enforced).
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

      {isMe ? <Composer circleId={id} /> : null}

      {posts.length === 0 && today && !isMe ? (
        <Card>
          <View style={styles.center}>
            <Egg size={70} />
            <Body muted>waiting on {nameOf(today.userId)} · any minute now</Body>
          </View>
        </Card>
      ) : null}

      {[...posts].reverse().map((p) => (
        <PhotoPost key={p.id} share={p} author={nameOf(p.author_id)} myId={myId} />
      ))}

      {spotlight.data && spotlight.data.week.length > 0 ? (
        <>
          <Label>up next</Label>
          <View style={styles.week}>
            {spotlight.data.week.map((d) => (
              <View key={d.day} style={[styles.day, d.day === today?.day && styles.dayToday]}>
                <Text style={styles.dayName}>{d.day === today?.day ? 'today' : short(d.day)}</Text>
                <Text style={styles.dayWho} numberOfLines={1}>
                  {nameOf(d.userId)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
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

function Composer({ circleId }: { circleId: string }) {
  const pick = usePhotoPicker();
  const capture = useCameraCapture();
  const post = usePostDailyPhoto();
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [egg, setEgg] = useState({ swatch: 'butter', pattern: 'dots' });
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<string | null>) => {
    setError(null);
    try {
      const uri = await f();
      if (uri) setPhoto(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <Label>send today&apos;s photo</Label>
      {photo ? (
        <View style={styles.photoWrap}>
          <PhotoThumb uri={photo} size={260} />
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="camera" onPress={() => void run(capture)} />
          </View>
          <View style={styles.flex}>
            <Button variant="secondary" label="library" onPress={() => void run(pick)} />
          </View>
        </View>
      )}

      <Label>decorate it!</Label>
      <View style={styles.center}>
        <Egg size={96} swatch={egg.swatch} pattern={egg.pattern} text={text || null} />
      </View>
      <EggStylePicker swatch={egg.swatch} pattern={egg.pattern} onChange={setEgg} />
      <TextField label="write on your egg" value={text} onChangeText={setText} maxLength={60} placeholder="my shoes, right now" />

      {error ? <Body error>{error}</Body> : null}
      {post.error ? <Body error>couldn&apos;t post: {post.error.message}</Body> : null}
      <Button
        label="send to the group"
        disabled={!photo && !text.trim()}
        loading={post.isPending}
        onPress={() =>
          post.mutate(
            { circleId, body: text, eggStyle: egg, photoUri: photo },
            {
              onSuccess: () => {
                setPhoto(null);
                setText('');
              },
            },
          )
        }
      />
      {photo ? <Button variant="secondary" label="pick a different photo" onPress={() => setPhoto(null)} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  prompt: { ...type.title, color: colors.text },
  whose: { ...type.body, ...weight('700'), color: colors.primaryDeep },
  center: { alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  photoWrap: { alignItems: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  author: { ...type.heading, color: colors.text },
  time: { ...type.caption, color: colors.textMuted },
  body: { ...type.body, color: colors.text },
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  day: { minWidth: 76, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  dayToday: { backgroundColor: colors.primary },
  dayName: { ...type.label, color: colors.textSecondary },
  dayWho: { ...type.body, ...weight('700'), color: colors.text },
});
