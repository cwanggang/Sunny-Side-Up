import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCameraCapture, useCoops, useDailyPrompt, usePhotoPicker, usePostDailyPhoto, useSession } from '@/api';
import { Body, Button, EggStylePicker } from '@/components';
import { FriedEgg } from '@/components/Egg';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

// Design v0.5 camera (A5, Developer B): "to: <coop>" picks which of today's coops gets the photo
// (only coops where it's your day), today's prompt, the egg shutter (system camera) or your photos,
// then write on your egg and send. Posts a daily photo (spotlight share) through @/api.
export default function CameraScreen() {
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coops = useCoops();
  const prompt = useDailyPrompt();
  const capture = useCameraCapture();
  const pick = usePhotoPicker();
  const post = usePostDailyPhoto();

  const myDays = (coops.data ?? []).filter((c) => c.today_user_id === myId);
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = myDays.find((c) => c.id === targetId) ?? myDays.find((c) => !c.today_posted) ?? myDays[0];
  const [toOpen, setToOpen] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [egg, setEgg] = useState({ swatch: 'butter', pattern: 'none' });
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const size = width - spacing.lg * 2;

  async function shoot(fromLibrary: boolean) {
    setError(null);
    try {
      const u = await (fromLibrary ? pick() : capture());
      if (u) setUri(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function send() {
    if (!target || !uri) return;
    post.mutate(
      { circleId: target.id, body: text, eggStyle: egg, photoUri: uri },
      {
        onSuccess: () => {
          setSentTo(target.name);
          void coops.refetch();
        },
      },
    );
  }

  if (sentTo) {
    const more = myDays.filter((c) => !c.today_posted && c.name !== sentTo);
    return (
      <SafeAreaView style={[styles.root, styles.sent]}>
        <Text style={styles.label}>sent to</Text>
        <Text style={styles.sentName}>{sentTo}</Text>
        {uri ? <Image source={{ uri }} style={[styles.sentPhoto, { width: size * 0.7, height: size * 0.7 }]} contentFit="cover" /> : null}
        <Text style={styles.muted}>your coop can react now. photos last until the next rotation.</Text>
        <View style={styles.sentActions}>
          <Button label="back home" onPress={() => router.back()} />
          {more.length ? (
            <Button
              variant="secondary"
              label={`send one to ${more[0].name}`}
              onPress={() => {
                setTargetId(more[0].id);
                setSentTo(null);
                setUri(null);
                setText('');
              }}
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="close camera" onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="choose which coop"
            disabled={myDays.length < 2}
            onPress={() => setToOpen((o) => !o)}
            style={styles.toPill}
          >
            <Text style={styles.toText}>
              to: <Text style={{ ...weight('800') }}>{target?.name ?? '…'}</Text>
              {myDays.length > 1 ? '  ⌄' : ''}
            </Text>
          </Pressable>
          <View style={{ width: 42 }} />
        </View>
        {toOpen ? (
          <View style={styles.toMenu}>
            <Text style={styles.label}>your day in</Text>
            {myDays.map((c) => (
              <Pressable
                key={c.id}
                disabled={c.today_posted}
                onPress={() => {
                  setTargetId(c.id);
                  setToOpen(false);
                }}
                style={styles.toRow}
              >
                <Text style={[styles.toRowText, c.today_posted && { color: colors.textMuted }]}>🥚 {c.name}</Text>
                <Text style={styles.muted}>{c.today_posted ? 'sent' : c.id === target?.id ? '✓' : ''}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!coops.isPending && myDays.length === 0 ? (
          <View style={styles.none}>
            <FriedEgg size={110} />
            <Body muted>it&apos;s not your day in any coop today. you&apos;ll get a reminder when it is.</Body>
            <Button label="back home" onPress={() => router.back()} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={[styles.vf, { width: size, height: size }]}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="open the camera" onPress={() => void shoot(false)} style={styles.vfEmpty}>
                  <Text style={styles.vfHint}>tap the egg to take today&apos;s photo</Text>
                </Pressable>
              )}
              <Text style={styles.chip}>1:1</Text>
            </View>

            <View style={styles.prompt}>
              <Text style={styles.label}>today&apos;s prompt</Text>
              <Text style={styles.promptText}>{prompt.data ?? '…'}</Text>
            </View>

            {error ? <Body error>{error}</Body> : null}
            {post.error ? <Body error>couldn&apos;t send: {post.error.message}</Body> : null}

            {uri ? (
              <>
                <View style={styles.deco}>
                  <Text style={styles.label}>write on your egg</Text>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    maxLength={40}
                    placeholder="hi friends"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                  <EggStylePicker swatch={egg.swatch} pattern={egg.pattern} onChange={setEgg} />
                </View>
                <View style={styles.review}>
                  <View style={{ flex: 1 }}>
                    <Button variant="secondary" label="retake" onPress={() => setUri(null)} disabled={post.isPending} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="send ➜" onPress={send} loading={post.isPending} disabled={!target || target.today_posted} />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.controls}>
                <Pressable accessibilityRole="button" accessibilityLabel="choose from your photos" onPress={() => void shoot(true)} style={styles.side}>
                  <Text style={styles.sideIcon}>🖼️</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="take photo" onPress={() => void shoot(false)} style={({ pressed }) => [pressed && { transform: [{ scale: 0.94 }] }]}>
                  <FriedEgg size={104} />
                </Pressable>
                <View style={styles.side} />
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...type.heading, color: colors.text },
  toPill: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  toText: { ...type.body, color: colors.text },
  toMenu: { ...shadow.card, position: 'absolute', top: 64, alignSelf: 'center', zIndex: 10, minWidth: 220, padding: spacing.md, gap: spacing.xs, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  toRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  toRowText: { ...type.body, ...weight('700'), color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, alignItems: 'center' },
  vf: { borderRadius: radii.xl, overflow: 'hidden', backgroundColor: palette.pan, borderWidth: 2, borderColor: palette.ink },
  vfEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vfHint: { ...type.body, color: palette.bg2 },
  chip: { position: 'absolute', top: 10, right: 10, ...type.label, color: colors.text, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, overflow: 'hidden' },
  prompt: { alignItems: 'center', gap: 2 },
  promptText: { ...type.title, color: colors.text, textAlign: 'center' },
  label: { ...type.label, color: colors.textSecondary },
  muted: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  side: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  sideIcon: { fontSize: 22 },
  deco: { alignSelf: 'stretch', gap: spacing.sm, padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  input: { ...type.body, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  review: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  none: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  sent: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  sentName: { ...type.display, color: colors.text },
  sentPhoto: { borderRadius: radii.xl, borderWidth: 2, borderColor: palette.ink, transform: [{ rotate: '-2deg' }] },
  sentActions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
});
