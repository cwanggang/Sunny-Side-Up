import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radii, type } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
}

/** Labelled text input (the prototype's `.field`): white, 1px line, yolk border while focused. */
export function TextField({ label, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primaryDeep}
        style={[styles.input, focused && styles.focused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { ...type.label, color: colors.textSecondary, marginHorizontal: 6 },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  focused: { borderColor: colors.primary },
});
