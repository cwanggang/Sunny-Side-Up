import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

/** One tappable row: title, optional subtitle, chevron when tappable. */
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: spacing.xs },
  title: { ...type.body, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted },
  chevron: { ...type.title, color: colors.textMuted },
});
