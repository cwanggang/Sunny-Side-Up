// Design v0.4 events page body (Developer B): upcoming list with opt-out eggs, month calendar,
// and the selected day's events. Shared by circle/[id]/events and the all-coops calendar.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { chatOpen, isPast, useCoops, useEvents, useSession, useSetOptOut, type EventSummary } from '@/api';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

import { Body } from './Text';
import { EggButton, Section } from './Coop';
import { Egg } from './Egg';
import { MonthCalendar, ymd } from './Gallery';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const fmtShort = (d: Date) => `${DAYS[d.getDay()].slice(0, 3)}, ${MON[d.getMonth()]} ${d.getDate()}`;
export const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
export const fmtLong = (d: Date) => `${DAYS[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;

export function EventsView({ circleId }: { circleId: string | null }) {
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const events = useEvents(circleId);
  const coops = useCoops();
  const optOut = useSetOptOut();
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(null);

  const list = useMemo(() => events.data ?? [], [events.data]);
  const upcoming = list.filter((e) => !isPast(e));
  const marked = useMemo(() => new Set(list.map((e) => ymd(new Date(e.starts_at)))), [list]);
  const dayEvents = day ? list.filter((e) => ymd(new Date(e.starts_at)) === day) : [];
  const coopName = (id: string) => coops.data?.find((c) => c.id === id)?.name ?? '';

  const mine = (e: EventSummary) => e.people.find((p) => p.user_id === myId);

  return (
    <View style={styles.root}>
      {events.error ? <Body error>couldn&apos;t load events: {events.error.message}</Body> : null}

      <Section title="upcoming 🥚" />
      {upcoming.length === 0 && !events.isPending ? (
        <Body muted>nothing planned yet. tap the egg below to start something.</Body>
      ) : null}
      {upcoming.map((e) => {
        const me = mine(e);
        const out = !!me?.opted_out;
        const start = new Date(e.starts_at);
        const unread = chatOpen(e) && !!e.lastMessageBy && e.lastMessageBy !== myId && !out;
        return (
          <View key={e.id} style={[styles.row, out && styles.rowOut]}>
            {me ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${out ? 'rejoin' : 'opt out of'} ${e.title}`}
                onPress={() => optOut.mutate({ eventId: e.id, out: !out })}
                style={styles.opt}
              >
                <Egg size={24} swatch={out ? 'shell' : 'butter'} pattern={out ? 'zigzag' : 'none'} />
                <Text style={styles.optText}>{out ? 'rejoin' : 'opt out'}</Text>
              </Pressable>
            ) : (
              <View style={styles.opt} />
            )}
            <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${e.id}`)} style={styles.main}>
              <Text style={styles.title} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {out ? 'you opted out' : circleId ? (e.location ?? '') : coopName(e.circle_id)}
              </Text>
            </Pressable>
            <View style={styles.when}>
              <Text style={styles.whenText}>{fmtShort(start)}</Text>
              <Text style={styles.whenText}>{fmtTime(start)}</Text>
            </View>
            {e.chat_enabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`open the chat for ${e.title}`}
                onPress={() => router.push(`/event/${e.id}?tab=chat`)}
                style={[styles.chat, !chatOpen(e) && { opacity: 0.4 }]}
              >
                <Text style={styles.chatIcon}>💬</Text>
                {unread ? <View style={styles.badge} /> : null}
              </Pressable>
            ) : (
              <View style={styles.chat} />
            )}
          </View>
        );
      })}

      <Section title="calendar" />
      <MonthCalendar month={month} onMonth={setMonth} marked={marked} selected={day} onSelect={setDay} />
      {!day ? (
        <Body muted>tap a day to look back at past events, their chats and photos, or ahead at what&apos;s coming</Body>
      ) : dayEvents.length === 0 ? (
        <Body muted>nothing on {fmtLong(new Date(`${day}T12:00:00`))}</Body>
      ) : (
        dayEvents.map((e) => {
          const start = new Date(e.starts_at);
          const me = mine(e);
          const going = e.people.filter((p) => !p.opted_out).length;
          const status = isPast(e) ? 'this already happened' : me?.opted_out ? 'you opted out' : `${going} going`;
          return (
            <View key={e.id} style={styles.dayCard}>
              <Text style={styles.title}>{e.title}</Text>
              <Text style={styles.sub}>
                {fmtLong(start)} at {fmtTime(start)}
                {circleId ? '' : `, ${coopName(e.circle_id)}`}
              </Text>
              <Text style={styles.sub}>{status}</Text>
              <View style={styles.chips}>
                <Chip label="details" onPress={() => router.push(`/event/${e.id}`)} />
                {e.chat_enabled ? <Chip label={chatOpen(e) ? '💬 chat' : '🔒 past chat'} onPress={() => router.push(`/event/${e.id}?tab=chat`)} /> : null}
                {e.gallery_enabled ? <Chip label="🖼 photos" onPress={() => router.push(`/event/${e.id}?tab=gallery`)} /> : null}
              </View>
            </View>
          );
        })
      )}

      <EggButton label="create event" onPress={() => router.push(circleId ? `/event/new?circleId=${circleId}` : '/event/new')} />
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  rowOut: { opacity: 0.55 },
  opt: { width: 46, alignItems: 'center', gap: 2 },
  optText: { ...type.label, fontSize: 10, color: colors.textMuted },
  main: { flex: 1, gap: 2 },
  title: { ...type.heading, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted },
  when: { alignItems: 'flex-end' },
  whenText: { ...type.caption, ...weight('600'), color: colors.text },
  chat: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: palette.coral },
  dayCard: { gap: 2, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.surface },
  chipText: { ...type.caption, ...weight('600'), color: colors.text },
});
