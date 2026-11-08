import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useCircle, useHangoutIdeas } from '@/api';
import { Body, Button, Label, Screen } from '@/components';
import { colors, radii, shadow, spacing, type } from '@/theme';

// A3.5 hangout ideas (design v0.3 restyle, B5.2: "up next" cards): three AI ideas based on the circle's size, home area, and the day of the week.
export default function HangoutsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const circle = useCircle(id);
  const ideas = useHangoutIdeas(id);
  const loading = ideas.isFetching;

  return (
    <Screen title="hangout ideas">
      <Label>up next?</Label>
      <Body muted>
        {circle.data?.home_area
          ? `ideas near ${circle.data.home_area.toLowerCase()}`
          : 'tip: set a home area for your group to get ideas near you'}
      </Body>

      {loading ? <Body muted>cracking some ideas…</Body> : null}
      {ideas.error && !loading ? <Body error>couldn&apos;t get ideas: {ideas.error.message}</Body> : null}

      {!loading &&
        ideas.data?.map((idea) => (
          <View key={idea.title} style={styles.card}>
            <Text style={styles.title}>{idea.title.toLowerCase()}</Text>
            <Text style={styles.where}>📍 {idea.where.toLowerCase()}</Text>
            <Text style={styles.why}>{idea.why}</Text>
          </View>
        ))}

      <Button variant="secondary" label="more ideas" onPress={() => void ideas.refetch()} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  title: { ...type.title, color: colors.text },
  where: { ...type.caption, color: colors.textMuted },
  why: { ...type.body, color: colors.textSecondary },
});
