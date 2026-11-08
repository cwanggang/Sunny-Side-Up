import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, type, weight } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** Small pill button: recipient picker, reaction buttons. */
export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The prototype's chips: white pill with a 1px line; selected = navy with white text.
  chip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.solid, borderColor: colors.solid },
  pressed: { transform: [{ scale: 0.95 }] },
  label: { ...type.caption, ...weight('500'), color: colors.text },
  selectedLabel: { color: colors.solidText, ...weight('600') },
});
