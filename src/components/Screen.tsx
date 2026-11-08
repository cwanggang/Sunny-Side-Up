import { useNavigation } from 'expo-router';
import { useLayoutEffect, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing, type, weight } from '@/theme';

interface ScreenProps {
  /** Header title for this screen. */
  title?: string;
  /** Short placeholder line, e.g. which task builds this screen. */
  note?: string;
  /** Pull to refresh: pass both. */
  refreshing?: boolean;
  onRefresh?: () => void;
  children?: ReactNode;
}

/** Plain scrollable page used by every screen. */
export function Screen({ title, note, refreshing, onRefresh, children }: ScreenProps) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    // Header matches the page: sage background, navy bold title, no divider line.
    navigation.setOptions({
      ...(title ? { title } : {}),
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { ...weight('700'), color: colors.text },
      headerShadowVisible: false,
    });
  }, [navigation, title]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      // iOS headers and tab bars are translucent and overlap the scroll view; this insets content below/above them.
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  note: { ...type.caption, color: colors.textMuted },
});
