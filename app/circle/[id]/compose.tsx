import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useCameraCapture,
  useCircleMembers,
  usePhotoPicker,
  useSendEgg,
  useSendPhoto,
  useSendText,
  useSendVoice,
  useSession,
  useVoiceRecorder,
} from '@/api';
import { Body, Button, Chip, Heading, PhotoThumb, Screen, TextField, VoiceMemo } from '@/components';
import { spacing } from '@/theme';

const MAX_VOICE_SECONDS = 60;

// A2.6 compose: send an egg, text, photo or voice memo to one person or the whole circle.
// `?to=<userId>` preselects a recipient (used later by nudges' quick actions).
export default function ComposeScreen() {
  const { id, to } = useLocalSearchParams<{ id: string; to?: string }>();
  const { session } = useSession();
  const members = useCircleMembers(id);
  const others = members.data?.filter((m) => m.userId !== session?.user.id) ?? [];

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
    <Screen title="Send something">
      <Heading>To</Heading>
      <View style={styles.chips}>
        <Chip label="Everyone" selected={recipientId === null} onPress={() => setRecipientId(null)} />
        {others.map((m) => (
          <Chip
            key={m.userId}
            label={m.displayName}
            selected={recipientId === m.userId}
            onPress={() => setRecipientId(m.userId)}
          />
        ))}
      </View>
      {recipientId ? <Body muted>Only you and they will see it.</Body> : null}

      {sendError ? <Body error>Couldn&apos;t send: {sendError.message}</Body> : null}
      {mediaError ? <Body error>{mediaError}</Body> : null}

      <Heading>Egg</Heading>
      <Button label="Send an egg 🥚" onPress={() => sendEgg.mutate(target, done)} disabled={sending} loading={sendEgg.isPending} />

      <Heading>Text</Heading>
      <TextField label="Message" value={text} onChangeText={setText} multiline maxLength={500} placeholder="Thinking of you!" />
      <Button
        label="Send text"
        onPress={() => sendText.mutate({ ...target, body: text }, done)}
        disabled={sending || !text.trim()}
        loading={sendText.isPending}
      />

      <Heading>Photo</Heading>
      {photoUri ? (
        <>
          <PhotoThumb uri={photoUri} />
          <View style={styles.row}>
            <View style={styles.half}>
              <Button variant="secondary" label="Discard" onPress={() => setPhotoUri(null)} disabled={sending} />
            </View>
            <View style={styles.half}>
              <Button
                label="Send photo"
                onPress={() => sendPhoto.mutate({ ...target, uri: photoUri }, done)}
                disabled={sending}
                loading={sendPhoto.isPending}
              />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <View style={styles.half}>
            <Button variant="secondary" label="Choose photo" onPress={() => void getPhoto('library')} disabled={sending} />
          </View>
          <View style={styles.half}>
            <Button variant="secondary" label="Take photo" onPress={() => void getPhoto('camera')} disabled={sending} />
          </View>
        </View>
      )}

      <Heading>Voice memo</Heading>
      {recorder.uri && !recorder.isRecording ? (
        <>
          <VoiceMemo uri={recorder.uri} />
          <Body muted>{seconds}s recorded</Body>
          <View style={styles.row}>
            <View style={styles.half}>
              <Button variant="secondary" label="Discard" onPress={recorder.reset} disabled={sending} />
            </View>
            <View style={styles.half}>
              <Button
                label="Send voice memo"
                onPress={() =>
                  sendVoice.mutate({ ...target, uri: recorder.uri!, durationMs: recorder.durationMs }, done)
                }
                disabled={sending}
                loading={sendVoice.isPending}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Button
            variant={recorder.isRecording ? 'danger' : 'secondary'}
            label={recorder.isRecording ? `Stop (${seconds}s / ${MAX_VOICE_SECONDS}s)` : 'Record'}
            onPress={() => void toggleRecording()}
            disabled={sending}
          />
          <Body muted>Up to {MAX_VOICE_SECONDS} seconds.</Body>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
