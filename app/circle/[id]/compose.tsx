import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  useCameraCapture,
  useCircleMembers,
  useCoop,
  usePeople,
  usePhotoPicker,
  useSendEgg,
  useSendPhoto,
  useSendText,
  useSendVoice,
  useSession,
  useVoiceRecorder,
} from '@/api';
import { Body, Button, PhotoThumb, Screen, VoiceMemo } from '@/components';
import { Avatar, Segmented } from '@/components/Coop';
import { Egg } from '@/components/Egg';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

const MAX_VOICE_SECONDS = 60;
const KINDS = ['egg', 'text', 'photo', 'voice'] as const;
type Kind = (typeof KINDS)[number];

// A2.6 compose, design v0.5 look (A5.2, Developer B): send an egg, text, photo or voice memo to
// one person or the whole coop. `?to=<userId>` preselects a recipient (nudge quick actions).
export default function ComposeScreen() {
  const { id, to } = useLocalSearchParams<{ id: string; to?: string }>();
  const { session } = useSession();
  const coop = useCoop(id);
  const members = useCircleMembers(id);
  const people = usePeople();
  const others = members.data?.filter((m) => m.userId !== session?.user.id) ?? [];

  const [kind, setKind] = useState<Kind>('egg');
  const [recipientId, setRecipientId] = useState<string | null>(to ?? null);
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const sendEgg = useSendEgg();
  const sendText = useSendText();
  const sendPhoto = useSendPhoto();
  const sendVoice = useSendVoice();
  const pickPhoto = usePhotoPicker();
  const takePhoto = useCameraCapture();
  const recorder = useVoiceRecorder();

  const target = { circleId: id, recipientId };
  const done = { onSuccess: () => router.back() };
  const sending = sendEgg.isPending || sendText.isPending || sendPhoto.isPending || sendVoice.isPending;
  const sendError = sendEgg.error ?? sendText.error ?? sendPhoto.error ?? sendVoice.error;
  const toName = recipientId ? (others.find((m) => m.userId === recipientId)?.displayName ?? 'them') : (coop?.name ?? 'everyone');

  async function getPhoto(source: 'library' | 'camera') {
    setMediaError(null);
    try {
      const uri = await (source === 'camera' ? takePhoto() : pickPhoto());
      if (uri) setPhotoUri(uri);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleRecording() {
    setMediaError(null);
    try {
      if (recorder.isRecording) await recorder.stop();
      else await recorder.start();
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : String(e));
    }
  }

  const seconds = Math.floor(recorder.durationMs / 1000);

  return (
    <Screen title="send something">
      <Text style={styles.label}>to</Text>
      <View style={styles.people}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: recipientId === null }}
          onPress={() => setRecipientId(null)}
          style={[styles.person, recipientId === null && styles.personOn]}
        >
          <View style={styles.everyone}>
            <Text style={{ fontSize: 22 }}>🥚</Text>
          </View>
          <Text style={styles.personName}>everyone</Text>
        </Pressable>
        {others.map((m) => {
          const p = people.data?.people.get(m.userId);
          const on = recipientId === m.userId;
          return (
            <Pressable
              key={m.userId}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setRecipientId(m.userId)}
              style={[styles.person, on && styles.personOn]}
            >
              {p ? <Avatar person={p} size={44} /> : <View style={styles.everyone} />}
              <Text style={styles.personName} numberOfLines={1}>
                {p?.username ?? m.displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.muted}>{recipientId ? 'only you and they will see it.' : 'the whole coop will see it.'}</Text>

      <Segmented options={KINDS} value={kind} onChange={setKind} />

      {sendError ? <Body error>couldn&apos;t send: {sendError.message}</Body> : null}
      {mediaError ? <Body error>{mediaError}</Body> : null}

      <View style={styles.panel}>
        {kind === 'egg' ? (
          <>
            <Egg size={90} swatch="butter" pattern="dots" />
            <Text style={styles.panelText}>a little egg to say hi to {toName}</Text>
            <Button label="send an egg 🥚" onPress={() => sendEgg.mutate(target, done)} disabled={sending} loading={sendEgg.isPending} />
          </>
        ) : null}

        {kind === 'text' ? (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              placeholder="thinking of you!"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Button
              label="send"
              onPress={() => sendText.mutate({ ...target, body: text }, done)}
              disabled={sending || !text.trim()}
              loading={sendText.isPending}
            />
          </>
        ) : null}

        {kind === 'photo' ? (
          photoUri ? (
            <>
              <PhotoThumb uri={photoUri} />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Button variant="secondary" label="discard" onPress={() => setPhotoUri(null)} disabled={sending} />
                </View>
                <View style={styles.half}>
                  <Button label="send photo" onPress={() => sendPhoto.mutate({ ...target, uri: photoUri }, done)} disabled={sending} loading={sendPhoto.isPending} />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.row}>
              <View style={styles.half}>
                <Button variant="secondary" label="choose photo" onPress={() => void getPhoto('library')} disabled={sending} />
              </View>
              <View style={styles.half}>
                <Button label="take photo" onPress={() => void getPhoto('camera')} disabled={sending} />
              </View>
            </View>
          )
        ) : null}

        {kind === 'voice' ? (
          recorder.uri && !recorder.isRecording ? (
            <>
              <VoiceMemo uri={recorder.uri} />
              <Text style={styles.muted}>{seconds}s recorded</Text>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Button variant="secondary" label="again" onPress={recorder.reset} disabled={sending} />
                </View>
                <View style={styles.half}>
                  <Button
                    label="send memo"
                    onPress={() => sendVoice.mutate({ ...target, uri: recorder.uri!, durationMs: recorder.durationMs }, done)}
                    disabled={sending}
                    loading={sendVoice.isPending}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recorder.isRecording ? 'stop recording' : 'start recording'}
                onPress={() => void toggleRecording()}
                disabled={sending}
                style={[styles.yolk, recorder.isRecording && styles.yolkRec]}
              >
                <Text style={styles.yolkText}>{recorder.isRecording ? '■' : '●'}</Text>
              </Pressable>
              <Text style={styles.time}>
                0:{String(seconds).padStart(2, '0')}
              </Text>
              <Text style={styles.muted}>{recorder.isRecording ? 'tap the yolk to stop' : `tap the yolk to record (up to ${MAX_VOICE_SECONDS}s)`}</Text>
            </>
          )
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.textSecondary },
  muted: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: { width: 76, alignItems: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: 2, borderColor: 'transparent' },
  personOn: { borderColor: palette.ink, backgroundColor: colors.primarySoft },
  personName: { ...type.caption, ...weight('700'), color: colors.text },
  everyone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  panel: { ...shadow.card, alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  panelText: { ...type.heading, color: colors.text, textAlign: 'center' },
  input: { ...type.body, alignSelf: 'stretch', minHeight: 110, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  half: { flex: 1 },
  yolk: { ...shadow.card, width: 110, height: 110, borderRadius: 55, backgroundColor: colors.yolk, borderWidth: 10, borderColor: colors.eggWhite, alignItems: 'center', justifyContent: 'center' },
  yolkRec: { backgroundColor: colors.accent },
  yolkText: { fontSize: 30, color: colors.text },
  time: { ...type.title, color: colors.text },
});
