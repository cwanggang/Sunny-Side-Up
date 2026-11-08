import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';

interface ToggleRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** A labelled on/off switch with an optional plain-language explanation. */
export function ToggleRow({ title, description, value, onValueChange, disabled }: ToggleRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  description: { ...type.caption, color: colors.textMuted },
});
