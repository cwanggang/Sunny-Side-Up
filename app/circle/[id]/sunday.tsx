import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useCircle } from '@/api';
import { Body, Card, EggMessage, Label, Screen, SundayTileView, useSundayTile } from '@/components';
import { Egg } from '@/components/Egg';
import { colors, spacing, type } from '@/theme';

// Sunny sunday (design v0.3 by Developer B; A5 art + flow from the v0.5 prototype). One tile that
// stays on screen and changes state like the prototype's: crack your egg → your person + "tap to
// respond" (opens the respond screen) → still frying → their egg arrives → "tap to open" (the
// full-screen reveal) → opened ("tap to watch again").
export default function SundayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const circle = useCircle(id);
  const tile = useSundayTile(id);
  // Re-read the in-memory cracked/opened flags when coming back from respond / reveal.
  const [, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));
  const { query: egg, egg: e, nameOf } = tile;
  const tileWidth = Math.min(width - spacing.xl * 2, 340);

  return (
    <Screen title="sunny sunday" refreshing={egg.isRefetching} onRefresh={() => void egg.refetch()}>
      {egg.isPending ? <Body muted>warming up the pan…</Body> : null}
      {egg.error ? <Body error>couldn&apos;t load sunday: {egg.error.message}</Body> : null}

      {egg.data === null ? (
        <Card>
          <View style={styles.center}>
            <Egg size={110} swatch="shell" pattern="dots" speckle />
            <Text style={styles.big}>sunny sunday is coming</Text>
            <Body muted>on sunday you get a secret person in this group. crack your egg to see who, then send them a little hello.</Body>
          </View>
        </Card>
      ) : null}

      {e ? (
        <View style={styles.center}>
          <SundayTileView
            width={tileWidth}
            state={tile.state}
            groupName={circle.data?.name?.toLowerCase()}
            partner={tile.partner}
            theirs={tile.theirs}
            {...tile.actions}
          />
        </View>
      ) : null}

      {e && !e.iSent && e.theySent && tile.state === 'B' ? (
        <Card tone="yolk">
          <Text style={styles.gift}>🎁 {nameOf(e.fromId)} sent you something</Text>
          <Body muted>record your message first to see what you received!</Body>
        </Card>
      ) : null}

      {e?.mine ? (
        <>
          <Label>what you sent {nameOf(e.sendTo)}</Label>
          <EggMessage share={e.mine} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  big: { ...type.title, color: colors.text, textAlign: 'center' },
  gift: { ...type.heading, color: colors.text },
});
