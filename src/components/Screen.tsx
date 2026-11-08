import { useNavigation } from 'expo-router';
import { useLayoutEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing, type } from '@/theme';

interface ScreenProps {
  /** Header title for this screen. */
  title?: string;
  /** Short placeholder line, e.g. which task builds this screen. */
  note?: string;
  children?: ReactNode;
}

/** Plain scrollable page used by every screen. */
export function Screen({ title, note, children }: ScreenProps) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      // iOS headers and tab bars are translucent and overlap the scroll view; this insets content below/above them.
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  note: { ...type.caption, color: colors.textMuted },
});
