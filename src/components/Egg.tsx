// Design v0.3 egg art, drawn with plain Views (no SVG package, so no native re-install).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, eggSwatches, palette, radii, spacing, type, type EggSwatch, weight } from '@/theme';

const swatchColor = (swatch?: string) => eggSwatches[(swatch as EggSwatch) ?? 'shell'] ?? eggSwatches.shell;

export const EGG_SWATCHES = Object.keys(eggSwatches) as EggSwatch[];
export const EGG_PATTERNS = ['none', 'dots', 'stripes', 'zigzag'] as const;

/** A whole (decorated) egg. `text` is written across the middle, like "write on your egg". */
export function Egg({
  swatch = 'shell',
  pattern = 'none',
  text,
  size = 120,
}: {
  swatch?: string;
  pattern?: string;
  text?: string | null;
  size?: number;
}) {
  const w = size;
  const h = size * 1.28;
  const dot = Math.max(5, size / 14);
  return (
    <View
      style={[styles.egg, { width: w, height: h, borderRadius: w / 2, backgroundColor: swatchColor(swatch) }]}
      accessibilityRole="image"
      accessibilityLabel={text ? `egg that says ${text}` : 'egg'}
    >
      {pattern === 'dots'
        ? [
            [0.22, 0.25], [0.62, 0.18], [0.75, 0.48], [0.3, 0.62], [0.58, 0.78], [0.18, 0.42],
          ].map(([x, y], i) => (
            <View
              key={i}
              style={{ position: 'absolute', left: x * w, top: y * h, width: dot, height: dot, borderRadius: dot, backgroundColor: palette.white, opacity: 0.85 }}
            />
          ))
        : null}
      {pattern === 'stripes'
        ? [0.3, 0.68].map((y) => (
            <View key={y} style={{ position: 'absolute', left: 0, right: 0, top: y * h, height: h * 0.07, backgroundColor: palette.white, opacity: 0.8 }} />
          ))
        : null}
      {pattern === 'zigzag' ? (
        <Text style={[styles.zigzag, { top: h * 0.2, fontSize: size / 7 }]} numberOfLines={1}>
          ︿︿︿︿︿
        </Text>
      ) : null}
      {text ? (
        <Text style={[styles.eggText, { fontSize: Math.max(12, size / 8), maxWidth: w * 0.8 }]} numberOfLines={2}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

/** A sunny-side-up egg: white blob + yolk, with an optional name under it. */
export function FriedEgg({ size = 120, label }: { size?: number; label?: string }) {
  return (
    <View style={styles.center}>
      <View style={{ width: size, height: size * 0.86, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.white, { width: size, height: size * 0.82, borderRadius: size * 0.42 }]} />
        <View style={[styles.white, { position: 'absolute', left: size * 0.08, top: 0, width: size * 0.6, height: size * 0.6, borderRadius: size }]} />
        <View
          style={{
            position: 'absolute',
            width: size * 0.38,
            height: size * 0.38,
            borderRadius: size,
            backgroundColor: colors.yolk,
            borderWidth: size * 0.025,
            borderColor: palette.yolkDeep,
          }}
        />
      </View>
      {label ? <Text style={styles.name}>{label}</Text> : null}
    </View>
  );
}

/** The frying pan ("still frying!"): you sent yours, waiting on theirs. */
export function Pan({ size = 130 }: { size?: number }) {
  return (
    <View style={[styles.center, { width: size * 1.3, height: size * 0.8 }]} accessibilityLabel="frying pan">
      <View style={{ position: 'absolute', right: 0, width: size * 0.42, height: size * 0.1, borderRadius: size, backgroundColor: palette.pan }} />
      <View style={{ width: size, height: size * 0.62, borderRadius: size, backgroundColor: palette.pan, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.82, height: size * 0.48, borderRadius: size, backgroundColor: '#3E4559', alignItems: 'center', justifyContent: 'center' }}>
          <FriedEgg size={size * 0.42} />
        </View>
      </View>
      <Text style={styles.steam}>〰 〰 〰</Text>
    </View>
  );
}

/** Pick an egg colour and pattern. */
export function EggStylePicker({
  swatch,
  pattern,
  onChange,
}: {
  swatch: string;
  pattern: string;
  onChange: (next: { swatch: string; pattern: string }) => void;
}) {
  return (
    <View style={styles.picker}>
      <View style={styles.row}>
        {EGG_SWATCHES.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`${s} egg`}
            accessibilityState={{ selected: s === swatch }}
            onPress={() => onChange({ swatch: s, pattern })}
            style={[styles.swatch, { backgroundColor: eggSwatches[s] }, s === swatch && styles.swatchOn]}
          />
        ))}
      </View>
      <View style={styles.row}>
        {EGG_PATTERNS.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: p === pattern }}
            onPress={() => onChange({ swatch, pattern: p })}
            style={[styles.patternChip, p === pattern && styles.patternChipOn]}
          >
            <Text style={styles.patternLabel}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  egg: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(31,41,69,0.12)' },
  eggText: { ...type.body, ...weight('700'), color: colors.text, textAlign: 'center' },
  zigzag: { position: 'absolute', color: palette.white, opacity: 0.9, letterSpacing: -2 },
  white: { backgroundColor: colors.eggWhite, borderWidth: 1, borderColor: palette.hair },
  name: { ...type.heading, color: colors.text, marginTop: spacing.xs },
  steam: { position: 'absolute', top: -spacing.lg, left: '22%', ...type.caption, color: colors.textMuted },
  picker: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 34, height: 42, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
  patternChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  patternChipOn: { borderColor: colors.text, backgroundColor: colors.primarySoft },
  patternLabel: { ...type.caption, ...weight('600'), color: colors.text },
});
