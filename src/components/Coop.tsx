// Design v0.4 coop pieces (Developer B): avatar, egg carton, coop card, segmented tabs, egg button.
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { formatCoopCode, inviteMessage, useMediaUrl, type CoopSummary, type Person } from '@/api';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

import { Egg } from './Egg';

/** Round profile picture, or the person's egg when they have no photo. */
export function Avatar({ person, size = 32 }: { person: Pick<Person, 'avatarPath' | 'egg' | 'username'>; size?: number }) {
  const url = useMediaUrl(person.avatarPath);
  if (url.data) {
    return <Image source={{ uri: url.data }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Egg size={size * 0.78} swatch={person.egg.swatch} pattern={person.egg.pattern} />
    </View>
  );
}

/** Overlapping avatars + "N going". */
export function AvatarStack({ people, label }: { people: Pick<Person, 'avatarPath' | 'egg' | 'username'>[]; label?: string }) {
  return (
    <View style={styles.stack}>
      {people.slice(0, 6).map((p, i) => (
        <View key={`${p.username}-${i}`} style={{ marginLeft: i ? -10 : 0, borderRadius: 20, borderWidth: 2, borderColor: colors.surface }}>
          <Avatar person={p} size={28} />
        </View>
      ))}
      {label ? <Text style={styles.stackLabel}>{label}</Text> : null}
    </View>
  );
}

/**
 * The egg carton: one egg per member (you front and center), a "+" seat to invite, and a lid.
 * Tapping the lid closes the carton to show the coop code and the share button.
 */
export function Carton({
  coop,
  members,
  myId,
  onMember,
}: {
  coop: Pick<CoopSummary, 'name' | 'invite_code'>;
  members: Person[];
  myId: string | null;
  onMember: (p: Person) => void;
}) {
  const [closed, setClosed] = useState(false);
  const shown = members.slice(0, 6);
  const more = members.length - shown.length;
  const rows = [shown.slice(0, 3), shown.slice(3, 6)];

  if (closed) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="open the carton" onPress={() => setClosed(false)} style={styles.lidClosed}>
        <Text style={styles.codeLabel}>coop code</Text>
        <Text style={styles.code}>{formatCoopCode(coop.invite_code)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Share.share({ message: inviteMessage(coop) })}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.copyText}>share invite</Text>
        </Pressable>
        <Text style={styles.hint}>tap the lid to open it again</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.carton}>
      <Pressable accessibilityRole="button" accessibilityLabel="close the carton to show the join code" onPress={() => setClosed(true)} style={styles.lid}>
        <Text style={styles.lidName}>{coop.name}</Text>
        <Text style={styles.hint}>👥 tap the lid to invite people</Text>
      </Pressable>
      <View style={styles.tray}>
        {rows.map((row, r) => (
          <View key={r} style={styles.trayRow}>
            {row.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`crack ${p.id === myId ? 'your' : `${p.username}'s`} egg`}
                onPress={() => onMember(p)}
                style={({ pressed }) => [styles.seat, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                <Egg size={52} swatch={p.egg.swatch} pattern={p.egg.pattern} />
                <Text style={styles.seatName} numberOfLines={1}>
                  {p.id === myId ? 'you' : p.username}
                </Text>
              </Pressable>
            ))}
            {shown.length < 6 && r === Math.floor(shown.length / 3) ? (
              <Pressable accessibilityRole="button" accessibilityLabel="invite someone" onPress={() => setClosed(true)} style={styles.seat}>
                <View style={styles.plus}>
                  <Text style={styles.plusText}>+</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ))}
        {more > 0 ? <Text style={styles.more}>+{more} more</Text> : null}
      </View>
    </View>
  );
}

/** One coop in "my groups": cover (or egg), name, members, streak, today's status. */
export function CoopCard({ coop, todayLabel, onPress }: { coop: CoopSummary; todayLabel: string; onPress: () => void }) {
  const cover = useMediaUrl(coop.cover_path);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cover}>
        {cover.data ? (
          <Image source={{ uri: cover.data }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Egg size={34} swatch="shell" pattern="dots" />
        )}
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardName} numberOfLines={1}>
          {coop.name}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {coop.members === 2 ? '1:1' : `${coop.members} eggs`} · {todayLabel}
        </Text>
      </View>
      <View style={styles.streak}>
        <Text style={styles.streakText}>🥚 {coop.streak}</Text>
      </View>
    </Pressable>
  );
}

/** Pill tabs like "details · chat · people · gallery". */
export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="tab"
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
          style={[styles.segBtn, o === value && styles.segOn]}
        >
          <Text style={[styles.segText, o === value && styles.segTextOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The big yolk egg button at the bottom ("create event", "add photos", "customize egg"). */
export function EggButton({ label, onPress, icon = '+' }: { label: string; onPress: () => void; icon?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.eggBtn, pressed && { transform: [{ scale: 0.96 }] }]}>
      <View style={styles.eggYolk}>
        <Text style={styles.eggIcon}>{icon}</Text>
      </View>
      <Text style={styles.eggLabel}>{label}</Text>
    </Pressable>
  );
}

/** Small section title with an optional thing on the right. */
export function Section({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

/** Label/value row (event details, profile). */
export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <View style={styles.kvVal}>{typeof children === 'string' ? <Text style={styles.kvText}>{children}</Text> : children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackLabel: { ...type.caption, color: colors.textSecondary, marginLeft: spacing.sm },
  carton: { ...shadow.card, borderRadius: radii.xl, backgroundColor: '#E8DFCD', borderWidth: 1.5, borderColor: palette.line, overflow: 'hidden' },
  lid: { backgroundColor: '#F1EADB', paddingVertical: spacing.lg, alignItems: 'center', gap: 2, borderBottomWidth: 1.5, borderColor: palette.line },
  lidName: { ...type.title, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },
  tray: { padding: spacing.lg, gap: spacing.md },
  trayRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  seat: { width: 76, alignItems: 'center', gap: 2 },
  seatName: { ...type.caption, ...weight('700'), color: colors.text },
  plus: { width: 52, height: 66, borderRadius: 26, borderWidth: 2, borderStyle: 'dashed', borderColor: palette.ink3, alignItems: 'center', justifyContent: 'center' },
  plusText: { ...type.title, color: colors.textMuted },
  more: { ...type.caption, textAlign: 'center', color: colors.text },
  lidClosed: { ...shadow.card, borderRadius: radii.xl, backgroundColor: '#F1EADB', borderWidth: 1.5, borderColor: palette.line, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  codeLabel: { ...type.label, color: colors.textSecondary },
  code: { ...type.display, letterSpacing: 2, color: colors.text },
  copyBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radii.pill, backgroundColor: colors.primary },
  copyText: { ...type.body, ...weight('700'), color: colors.primaryText },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  cover: { width: 54, height: 54, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardName: { ...type.heading, color: colors.text },
  cardSub: { ...type.caption, color: colors.textMuted },
  streak: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  streakText: { ...type.caption, ...weight('700'), color: colors.text },
  seg: { flexDirection: 'row', padding: 3, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, gap: 2 },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.pill, alignItems: 'center' },
  segOn: { backgroundColor: colors.surface, ...shadow.card },
  segText: { ...type.caption, ...weight('600'), color: colors.textSecondary },
  segTextOn: { color: colors.text, ...weight('700') },
  eggBtn: { alignSelf: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  eggYolk: { ...shadow.card, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, borderWidth: 6, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  eggIcon: { ...type.title, color: colors.primaryText },
  eggLabel: { ...type.caption, ...weight('700'), color: colors.text },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  sectionTitle: { ...type.heading, color: colors.text },
  kv: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  kvKey: { ...type.label, color: colors.textSecondary, width: 92, paddingTop: 3 },
  kvVal: { flex: 1 },
  kvText: { ...type.body, color: colors.text },
});
