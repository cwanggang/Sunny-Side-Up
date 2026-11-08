import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing, type } from '@/theme';

/** Section heading inside a screen. */
export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

/** Plain paragraph text. `muted` for secondary text, `error` for failures. */
export function Body({ children, muted, error }: { children: ReactNode; muted?: boolean; error?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, error && styles.error]}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: { ...type.title, color: colors.text, marginTop: spacing.md },
  body: { ...type.body, color: colors.text },
  muted: { color: colors.textMuted },
  error: { color: colors.danger },
});
