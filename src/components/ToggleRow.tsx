import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, radii, shadow, spacing, type, weight } from '@/theme';

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
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        // The prototype's `.tog`: yolk when on, grey when off, white knob.
        trackColor={{ true: colors.primary, false: colors.grey }}
        ios_backgroundColor={colors.grey}
        thumbColor={colors.eggWhite}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The prototype's `.set-row.two`.
  root: {
    ...shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  text: { flex: 1, gap: 3 },
  title: { ...type.body, ...weight('500'), color: colors.text },
  description: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
