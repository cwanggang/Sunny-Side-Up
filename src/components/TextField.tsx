import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
}

/** Plain labelled text input. */
export function TextField({ label, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  label: { ...type.caption, color: colors.textMuted },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
