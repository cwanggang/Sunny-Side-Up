import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, shadow, type } from '@/theme';

type Variant = 'primary' | 'secondary' | 'yolk' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * The prototype's `.pill` buttons: primary = navy "solid", secondary = white "ghost",
   * yolk = yellow "yolky" (celebratory actions), danger = ghost with red text.
   */
  variant?: Variant;
  /** 40px tall instead of 50 (the prototype's `.pill.small`). */
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

const textColor: Record<Variant, string> = {
  primary: colors.solidText,
  secondary: colors.text,
  yolk: colors.primaryText,
  danger: colors.danger,
};

export function Button({ label, onPress, variant = 'primary', small, disabled, loading }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={[styles.label, small && styles.smallLabel, { color: textColor[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { height: 40, paddingHorizontal: 18 },
  primary: { backgroundColor: colors.solid },
  secondary: { backgroundColor: colors.surface, ...shadow.card },
  yolk: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.surface, ...shadow.card },
  disabled: { opacity: 0.45 },
  // The prototype's :active { transform: scale(.95) }.
  pressed: { transform: [{ scale: 0.95 }] },
  label: { ...type.button },
  smallLabel: { fontSize: 14 },
});
