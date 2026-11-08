import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { eggOf, factsOf, useCoops, useMyFullProfile, usePeople, useSession, type Person } from '@/api';
import { Body, Card, Egg, FriedEgg, Screen } from '@/components';
import { Avatar } from '@/components/Coop';
import { colors, radii, spacing, type, weight } from '@/theme';

const COLOR_WORDS: Record<string, string> = {
  'tomato red': '#E5533D', 'sky blue': '#7DB8E8', 'forest green': '#3F7F55', 'burnt orange': '#CC6A2C', sage: '#A8B98F',
  lilac: '#C8A8E9', teal: '#3BA59B', navy: '#2D3E6B', magenta: '#C9409A', aqua: '#5ECFD0', gold: '#D4A537', olive: '#8A8F3C',
  lavender: '#B9A7E3', purple: '#8E5BC7', pink: '#F29BB8', red: '#D9443A', orange: '#F08A3C', yellow: '#F2C94C', green: '#5BAA6A',
  blue: '#4A86D9', brown: '#8B5E3C', black: '#222', white: '#FFF',
};
const fmtBday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toLowerCase();

// Design v0.4 a friend's egg (Developer B): tap twice to crack it, then their profile opens:
// photo, name, @username, birthday, mutual coops, and their "about me" facts.
export default function MemberScreen() {
  const { userId, circleId } = useLocalSearchParams<{ userId: string; circleId?: string }>();
  const { session } = useSession();
  const isMe = userId === session?.user.id;
  const people = usePeople();
  const mine = useMyFullProfile();
  const coops = useCoops();
  const [taps, setTaps] = useState(0);

  const fromPeople = people.data?.people.get(userId);
  const p: Person | undefined =
    fromPeople ??
    (isMe && mine.data
      ? {
          id: mine.data.id, name: mine.data.display_name, username: mine.data.username, avatarPath: mine.data.avatar_path,
          egg: eggOf(mine.data.egg_style), facts: factsOf(mine.data.facts), birthday: mine.data.birthday,
        }
      : undefined);
  const theirCoops = people.data?.coopsOf.get(userId) ?? [];
  const mutual = (coops.data ?? []).filter((c) => theirCoops.includes(c.id));
  const coopName = circleId ? coops.data?.find((c) => c.id === circleId)?.name : undefined;

  if (!p) {
    return (
      <Screen title="">
        {people.isPending ? <Body muted>finding their egg…</Body> : <Body muted>you can only see people you share a coop with.</Body>}
      </Screen>
    );
  }

  if (taps < 2) {
    return (
      <Screen title="">
        <View style={styles.stage}>
          <Text style={styles.from}>{isMe ? 'your egg, the way friends see it' : coopName ? `${p.username} in ${coopName}` : p.username}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`crack ${isMe ? 'your' : `${p.username}'s`} egg`}
            onPress={() => setTaps((t) => t + 1)}
            style={{ transform: [{ rotate: taps === 1 ? '-6deg' : '0deg' }] }}
          >
            <Egg size={170} swatch={p.egg.swatch} pattern={taps === 1 ? 'zigzag' : p.egg.pattern} text={p.username} />
          </Pressable>
          <Text style={styles.hint}>{taps === 0 ? 'tap to crack' : 'tap one more time'}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="">
      <Card>
        <View style={styles.center}>
          {p.avatarPath ? <Avatar person={p} size={110} /> : <FriedEgg size={110} />}
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.handle}>@{p.username}</Text>
          {p.birthday ? <Text style={styles.bday}>🎂 {fmtBday(p.birthday)}</Text> : null}
        </View>
        <Text style={styles.label}>{isMe ? 'your coops' : 'mutual coops'}</Text>
        <View style={styles.chips}>
          {mutual.length ? (
            mutual.map((c) => (
              <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/circle/${c.id}/coop`)} style={styles.chip}>
                <Text style={styles.chipText}>{c.name}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.hint}>none yet</Text>
          )}
        </View>
        {p.facts.map((f, i) => {
          const sw = f.k === 'favorite color' ? COLOR_WORDS[f.v.toLowerCase().trim()] : undefined;
          return (
            <View key={`${f.k}-${i}`} style={styles.fact}>
              <Text style={styles.factK}>{f.k}</Text>
              <View style={styles.factRow}>
                {sw ? <View style={[styles.swatch, { backgroundColor: sw }]} /> : null}
                <Text style={styles.factV}>{f.v}</Text>
              </View>
            </View>
          );
        })}
        {p.facts.length === 0 ? <Text style={styles.hint}>{isMe ? 'add facts on your profile' : 'no facts yet'}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxl },
  from: { ...type.label, color: colors.textSecondary },
  hint: { ...type.caption, color: colors.textMuted },
  center: { alignItems: 'center', gap: spacing.xs },
  name: { ...type.display, color: colors.text, textAlign: 'center' },
  handle: { ...type.body, color: colors.textSecondary },
  bday: { ...type.body, color: colors.text },
  label: { ...type.label, color: colors.textSecondary, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, ...weight('700'), color: colors.text },
  fact: { paddingVertical: spacing.sm, gap: 2 },
  factK: { ...type.label, color: colors.textSecondary },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  factV: { ...type.heading, color: colors.text },
});
