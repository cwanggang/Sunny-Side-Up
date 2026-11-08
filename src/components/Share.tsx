import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  isVoicePath,
  useCameraCapture,
  usePhotoPicker,
  usePostShare,
  useVoiceRecorder,
  type Share,
  type ShareKind,
} from '@/api';
import { colors, radii, shadow, spacing, type } from '@/theme';

import { Button } from './Button';
import { PhotoThumb, VoiceMemo } from './Media';
import { Body } from './Text';
import { TextField } from './TextField';

/** Write a Sunday or spotlight share: text plus an optional photo or voice memo. */
export function ShareComposer({ circleId, kind, placeholder }: { circleId: string; kind: ShareKind; placeholder?: string }) {
  const post = usePostShare();
  const pickPhoto = usePhotoPicker();
  const takePhoto = useCameraCapture();
  const recorder = useVoiceRecorder();
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voiceUri = recorder.isRecording ? null : recorder.uri;
  const attachment = photoUri ?? voiceUri;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function submit() {
    post.mutate(
      { circleId, kind, body: text, mediaUri: attachment ?? undefined },
      {
        onSuccess: () => {
          setText('');
          setPhotoUri(null);
          recorder.reset();
        },
      },
    );
  }

  return (
    <View style={styles.composer}>
      <TextField label="Your share" value={text} onChangeText={setText} multiline maxLength={1000} placeholder={placeholder} />

      {photoUri ? <PhotoThumb uri={photoUri} size={160} /> : null}
      {voiceUri ? <VoiceMemo uri={voiceUri} /> : null}

      {attachment ? (
        <Button
          variant="secondary"
          label={photoUri ? 'Remove photo' : 'Remove voice memo'}
          onPress={() => {
            setPhotoUri(null);
            recorder.reset();
          }}
        />
      ) : recorder.isRecording ? (
        <Button
          variant="danger"
          label={`Stop recording (${Math.floor(recorder.durationMs / 1000)}s)`}
          onPress={() => void run(recorder.stop)}
        />
      ) : (
        <View style={styles.row}>
          <View style={styles.third}>
            <Button variant="secondary" label="Photo" onPress={() => void run(async () => setPhotoUri(await pickPhoto()))} />
          </View>
          <View style={styles.third}>
            <Button variant="secondary" label="Camera" onPress={() => void run(async () => setPhotoUri(await takePhoto()))} />
          </View>
          <View style={styles.third}>
            <Button variant="secondary" label="Voice" onPress={() => void run(recorder.start)} />
          </View>
        </View>
      )}

      {error ? <Body error>{error}</Body> : null}
      {post.error ? <Body error>Couldn&apos;t post: {post.error.message}</Body> : null}
      <Button
        label="Post"
        onPress={submit}
        disabled={recorder.isRecording || (!text.trim() && !attachment)}
        loading={post.isPending}
      />
    </View>
  );
}

/** One posted share: who, when, text and media. */
export function SharePost({ share, author }: { share: Share; author: string }) {
  const when = new Date(share.created_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <View style={styles.post}>
      <Text style={styles.meta}>
        {author} · {when}
      </Text>
      {share.body ? <Text style={styles.body}>{share.body}</Text> : null}
      {share.media_path ? (
        isVoicePath(share.media_path) ? <VoiceMemo path={share.media_path} /> : <PhotoThumb path={share.media_path} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  third: { flex: 1 },
  post: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  meta: { ...type.caption, color: colors.textMuted },
  body: { ...type.body, color: colors.text },
});
