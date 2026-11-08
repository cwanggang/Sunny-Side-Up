import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  eggStyleOf,
  isVoicePath,
  useCircleMembers,
  usePhotoPicker,
  useSendSundayEgg,
  useSession,
  useSundayEgg,
  useVoiceRecorder,
  type Share,
  type SundayEgg,
} from '@/api';
import {
  Body,
  Button,
  Card,
  Egg,
  EggStylePicker,
  FriedEgg,
  Label,
  Pan,
  PhotoThumb,
  Screen,
  TextField,
  VoiceMemo,
} from '@/components';
import { colors, radii, spacing, type } from '@/theme';

// Design v0.3 "sunny sunday" (B5.2 handoff): crack your egg to see your secret person, send them a
// voice memo (or photo) in a decorated egg; the egg they sent you opens only after you send yours.
export default function SundayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const egg = useSundayEgg(id);
  const members = useCircleMembers(id);
  const nameOf = (userId: string | null) =>
    userId === session?.user.id ? 'you' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'your person').toLowerCase();
  const [cracked, setCracked] = useState(false);
  const [opened, setOpened] = useState(false);

  const e = egg.data;

  return (
    <Screen title="sunny sunday" refreshing={egg.isRefetching} onRefresh={() => void egg.refetch()}>
      {egg.isPending ? <Body muted>warming up the pan…</Body> : null}
      {egg.error ? <Body error>couldn&apos;t load sunday: {egg.error.message}</Body> : null}

      {egg.data === null ? (
        <Card>
          <View style={styles.center}>
            <Egg size={110} swatch="shell" pattern="dots" />
            <Text style={styles.big}>sunny sunday is coming</Text>
            <Body muted>on sunday you get a secret person in this group. crack your egg to see who, then send them a little hello.</Body>
          </View>
        </Card>
      ) : null}

      {e && !e.iSent && !cracked ? (
        <Card>
          <View style={styles.center}>
            <Pressable accessibilityRole="button" accessibilityLabel="crack your egg" onPress={() => setCracked(true)}>
              <Egg size={130} swatch="shell" pattern="dots" />
            </Pressable>
            <Text style={styles.big}>tap to crack</Text>
            <Body muted>who&apos;s your person?</Body>
            <Button label="crack it" onPress={() => setCracked(true)} />
          </View>
        </Card>
      ) : null}

      {e && !e.iSent && cracked ? <Respond egg={e} circleId={id} name={nameOf(e.sendTo)} fromName={nameOf(e.fromId)} /> : null}

      {e && e.iSent && !e.theirs ? (
        <Card>
          <View style={styles.center}>
            <Pan size={140} />
            <Text style={styles.big}>still frying!</Text>
            <Body muted>you sent {nameOf(e.sendTo)} your egg. waiting on {nameOf(e.fromId)}.</Body>
          </View>
        </Card>
      ) : null}

      {e && e.iSent && e.theirs ? (
        opened ? (
          <Opened share={e.theirs} from={nameOf(e.fromId)} />
        ) : (
          <Card>
            <View style={styles.center}>
              <Pressable accessibilityRole="button" accessibilityLabel="open the egg" onPress={() => setOpened(true)}>
                <Egg size={130} swatch={eggStyleOf(e.theirs).swatch} pattern={eggStyleOf(e.theirs).pattern} />
              </Pressable>
              <Text style={styles.big}>{nameOf(e.fromId)} sent you an egg!</Text>
              <Button label="tap to open" onPress={() => setOpened(true)} />
            </View>
          </Card>
        )
      ) : null}

      {e?.mine ? (
        <>
          <Label>what you sent {nameOf(e.sendTo)}</Label>
          <EggMessage share={e.mine} />
        </>
      ) : null}
    </Screen>
  );
}

function Respond({ egg, circleId, name, fromName }: { egg: SundayEgg; circleId: string; name: string; fromName: string }) {
  const recorder = useVoiceRecorder();
  const pickPhoto = usePhotoPicker();
  const send = useSendSundayEgg();
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [style, setStyle] = useState({ swatch: 'blush', pattern: 'dots' });
  const [error, setError] = useState<string | null>(null);
  const voice = recorder.isRecording ? null : recorder.uri;
  const media = voice ?? photo;

  const run = async (f: () => Promise<unknown>) => {
    setError(null);
    try {
      await f();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Card>
        <View style={styles.center}>
          <FriedEgg size={110} label={name} />
          <Body muted>you&apos;re sending {name} a message this week</Body>
        </View>
        <Label>this week&apos;s prompt</Label>
        <Text style={styles.prompt}>{egg.prompt}</Text>
      </Card>

      {egg.theySent ? (
        <Card tone="yolk">
          <Text style={styles.gift}>🎁 {fromName} sent you something</Text>
          <Body muted>record your message first to see what you received!</Body>
        </Card>
      ) : null}

      <Card>
        <Label>pick one</Label>
        {voice ? <VoiceMemo uri={voice} /> : null}
        {photo ? (
          <View style={styles.center}>
            <PhotoThumb uri={photo} size={220} />
          </View>
        ) : null}
        {recorder.isRecording ? (
          <Button variant="danger" label={`stop · ${Math.floor(recorder.durationMs / 1000)}s`} onPress={() => void run(recorder.stop)} />
        ) : media ? (
          <Button
            variant="secondary"
            label="start over"
            onPress={() => {
              setPhoto(null);
              recorder.reset();
            }}
          />
        ) : (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label="voice memo" onPress={() => void run(recorder.start)} />
            </View>
            <View style={styles.flex}>
              <Button variant="secondary" label="photo" onPress={() => void run(async () => setPhoto(await pickPhoto()))} />
            </View>
          </View>
        )}

        <Label>decorate it!</Label>
        <View style={styles.center}>
          <Egg size={96} swatch={style.swatch} pattern={style.pattern} text={text || null} />
        </View>
        <EggStylePicker swatch={style.swatch} pattern={style.pattern} onChange={setStyle} />
        <TextField label="write on your egg" value={text} onChangeText={setText} maxLength={60} placeholder="miss u" />

        {error ? <Body error>{error}</Body> : null}
        {send.error ? <Body error>couldn&apos;t send: {send.error.message}</Body> : null}
        <Button
          label={`send to ${name}`}
          disabled={recorder.isRecording || (!media && !text.trim())}
          loading={send.isPending}
          onPress={() => send.mutate({ circleId, egg, body: text, eggStyle: style, mediaUri: media })}
        />
      </Card>
    </>
  );
}

function EggMessage({ share }: { share: Share }) {
  const style = eggStyleOf(share);
  return (
    <Card>
      <View style={styles.center}>
        <Egg size={90} swatch={style.swatch} pattern={style.pattern} text={share.body} />
      </View>
      {share.media_path ? (
        isVoicePath(share.media_path) ? (
          <VoiceMemo path={share.media_path} />
        ) : (
          <View style={styles.center}>
            <PhotoThumb path={share.media_path} size={260} />
          </View>
        )
      ) : null}
    </Card>
  );
}

function Opened({ share, from }: { share: Share; from: string }) {
  return (
    <>
      <Label>from {from}</Label>
      <EggMessage share={share} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  big: { ...type.title, color: colors.text, textAlign: 'center' },
  prompt: { ...type.heading, color: colors.text },
  gift: { ...type.heading, color: colors.text, borderRadius: radii.md },
});
