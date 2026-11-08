import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMediaUrl, useVoicePlayer } from '@/api';
import { colors, radii, spacing, type } from '@/theme';

/** A photo from the private media bucket (by path) or a local file (by uri). */
export function PhotoThumb({ path, uri, size = 220 }: { path?: string | null; uri?: string | null; size?: number }) {
  const signed = useMediaUrl(uri ? null : (path ?? null));
  const source = uri ?? signed.data ?? null;
  return (
    <View style={[styles.photo, { width: size, height: size }]}>
      {source ? (
        <Image source={{ uri: source }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : signed.error ? (
        <Text style={styles.muted}>Couldn&apos;t load photo</Text>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Play/pause button for a voice memo from the media bucket (by path) or a local recording (by uri). */
export function VoiceMemo({ path, uri }: { path?: string | null; uri?: string | null }) {
  const signed = useMediaUrl(uri ? null : (path ?? null));
  const player = useVoicePlayer(uri ?? signed.data ?? null);
  const label = player.playing ? '⏸ Pause' : '▶︎ Play voice memo';
  const time = player.durationSec > 0 ? ` · ${fmt(player.playing ? player.positionSec : player.durationSec)}` : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void player.toggle()}
      disabled={!player.ready}
      style={({ pressed }) => [styles.voice, pressed && styles.pressed, !player.ready && styles.disabled]}
    >
      <Text style={styles.voiceLabel}>
        {signed.error ? "Couldn't load voice memo" : `${label}${time}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { ...type.caption, color: colors.textMuted },
  voice: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceLabel: { ...type.body, color: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
