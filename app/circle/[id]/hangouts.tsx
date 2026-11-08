import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useCircle, useHangoutIdeas } from '@/api';
import { Body, Button, Screen } from '@/components';
import { colors, radii, spacing, type } from '@/theme';

// A3.5 hangout ideas: three AI ideas based on the circle's size, home area, and the day of the week.
export default function HangoutsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const circle = useCircle(id);
  const ideas = useHangoutIdeas(id);
  const loading = ideas.isFetching;

  return (
    <Screen title="Hangout ideas">
      <Body muted>
        {circle.data?.home_area
          ? `Ideas near ${circle.data.home_area}.`
          : 'Tip: set a home area when creating a circle for ideas near you.'}
      </Body>

      {loading ? <Body muted>Thinking up ideas…</Body> : null}
      {ideas.error && !loading ? <Body error>Couldn&apos;t get ideas: {ideas.error.message}</Body> : null}

      {!loading &&
        ideas.data?.map((idea) => (
          <View key={idea.title} style={styles.card}>
            <Text style={styles.title}>{idea.title}</Text>
            <Text style={styles.where}>📍 {idea.where}</Text>
            <Text style={styles.why}>{idea.why}</Text>
          </View>
        ))}

      <Button variant="secondary" label="More ideas" onPress={() => void ideas.refetch()} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  where: { ...type.caption, color: colors.textMuted },
  why: { ...type.body, color: colors.text },
});
