import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadow, spacing, type, weight } from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

/** One row (the prototype's `.set-row`): white card, 1px line, title + optional subtitle, chevron when tappable. */
export function ListItem({ title, subtitle, onPress }: ListItemProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.hairline },
  text: { flex: 1, gap: 3 },
  title: { ...type.body, ...weight('500'), color: colors.text },
  subtitle: { ...type.caption, fontSize: 12, color: colors.textMuted },
  chevron: { ...type.title, color: colors.textMuted },
});
