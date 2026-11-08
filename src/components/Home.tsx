// Design v0.5 home pieces (A5 handoff to Developer B): the per-coop card stack (coop photo ·
// today's photo · up next), the sunny sunday tile, the bottom fried egg, and the corner menu.
// Plain Views and Animated only (no native packages, so no re-install).
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  isPast,
  useMediaUrl,
  useSpotlight,
  useSundayEgg,
  type CoopSummary,
  type EventSummary,
  type Person,
} from '@/api';
import { colors, palette, radii, shadow, spacing, type, weight } from '@/theme';

import { Avatar } from './Coop';
import { Egg, FriedEgg, Pan } from './Egg';

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();

type NameOf = (id: string | null | undefined) => string;

// ---------- weekday: one coop as a stack of three cards ----------

const SLOTS = [
  { x: 0, y: 0, r: '0deg', s: 1 },
  { x: 6, y: 8, r: '2.4deg', s: 0.965 },
  { x: -5, y: 15, r: '-2.2deg', s: 0.93 },
];

/** Name on top (opens the coop), three swipeable cards, dots under them. */
export function CoopStack({
  coop,
  myId,
  nameOf,
  peopleById,
  nextEvent,
}: {
  coop: CoopSummary;
  myId: string | null;
  nameOf: NameOf;
  peopleById: Map<string, Person> | undefined;
  nextEvent: EventSummary | undefined;
}) {
  const { width } = useWindowDimensions();
  const cardW = width - spacing.lg * 2 - 12;
  const cardH = Math.round(cardW * 1.08);
  const [top, setTop] = useState(0);
  const [drag] = useState(() => new Animated.Value(0));

  // One memo builds both, so the gesture handler and taps share the same lock (no refs needed).
  const { pan, cycle } = useMemo(() => {
    const lock = { busy: false };
    const flip = (dir: 1 | -1) => {
      if (lock.busy) return;
      lock.busy = true;
      Animated.timing(drag, { toValue: dir * width, duration: 220, useNativeDriver: true }).start(() => {
        setTop((t) => (t + 1) % 3);
        drag.setValue(0);
        lock.busy = false;
      });
    };
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => drag.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60 || Math.abs(g.vx) > 0.6) flip(g.dx > 0 ? 1 : -1);
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    });
    return { pan: responder, cycle: flip };
  }, [drag, width]);

  const mine = coop.today_user_id === myId;
  const cards = [
    <CoverCard key="cover" coop={coop} mine={mine} nameOf={nameOf} />,
    <PhotoCard key="photo" coop={coop} mine={mine} nameOf={nameOf} peopleById={peopleById} />,
    <EventCard key="event" coop={coop} event={nextEvent} peopleById={peopleById} />,
  ];

  return (
    <View style={styles.group}>
      <Pressable accessibilityRole="button" accessibilityLabel={`open ${coop.name}`} onPress={() => router.push(`/circle/${coop.id}/coop`)}>
        <Text style={styles.gName}>{coop.name}</Text>
      </Pressable>
      <View style={{ width: cardW + 12, height: cardH + 18 }} {...pan.panHandlers}>
        {[2, 1, 0].map((pos) => {
          const ci = (top + pos) % 3;
          const slot = SLOTS[pos];
          const isTop = pos === 0;
          const transform = isTop
            ? [
                { translateX: drag },
                { rotate: drag.interpolate({ inputRange: [-width, 0, width], outputRange: ['-15deg', '0deg', '15deg'] }) },
              ]
            : [{ translateX: slot.x }, { translateY: slot.y }, { rotate: slot.r }, { scale: slot.s }];
          return (
            <Animated.View key={ci} style={[styles.card, { width: cardW, height: cardH, transform }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${coop.name}: tap or swipe to flip through`}
                disabled={!isTop}
                onPress={() => cycle(-1)}
                style={styles.fill}
              >
                {cards[ci]}
              </Pressable>
            </Animated.View>
          );
        })}
        {mine ? (
          <View style={styles.badge} pointerEvents="none">
            <Egg size={22} swatch="butter" />
            {coop.today_posted ? <Text style={styles.tick}>✓</Text> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === top && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function CoverCard({ coop, mine, nameOf }: { coop: CoopSummary; mine: boolean; nameOf: NameOf }) {
  const cover = useMediaUrl(coop.cover_path);
  return (
    <View style={styles.fill}>
      <View style={styles.photo}>
        {cover.data ? (
          <Image source={{ uri: cover.data }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.center}>
            <Egg size={64} swatch="shell" pattern="dots" />
            <Text style={styles.muted}>{coop.members} eggs in this coop</Text>
          </View>
        )}
      </View>
      <View style={styles.foot}>
        {mine ? <Text style={[styles.footText, styles.underline]}>it&apos;s your day</Text> : (
          <Text style={styles.footText}>{coop.today_user_id ? `it's ${nameOf(coop.today_user_id)}'s day` : 'no one is up today'}</Text>
        )}
        <Text style={styles.streak}>🥚 {coop.streak}</Text>
      </View>
    </View>
  );
}

function PhotoCard({ coop, mine, nameOf, peopleById }: { coop: CoopSummary; mine: boolean; nameOf: NameOf; peopleById: Map<string, Person> | undefined }) {
  const spot = useSpotlight(coop.id);
  const posts = spot.data?.posts ?? [];
  const last = [...posts].reverse().find((p) => p.media_path) ?? posts[posts.length - 1];
  const url = useMediaUrl(last?.media_path ?? null);
  if (!last) {
    return (
      <View style={styles.fill}>
        <View style={[styles.photo, styles.center, { backgroundColor: colors.surfaceAlt }]}>
          <FriedEgg size={90} />
          <Text style={styles.emptyText}>{mine ? 'your photo goes here' : `waiting on ${nameOf(coop.today_user_id)}`}</Text>
        </View>
        <View style={styles.foot}>
          <Text style={styles.label}>{mine ? 'tap the yolk below' : 'any minute now'}</Text>
        </View>
      </View>
    );
  }
  const by = peopleById?.get(last.author_id);
  return (
    <View style={styles.fill}>
      <View style={styles.photo}>
        {url.data ? <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {last.body ? (
          <View style={styles.caption}>
            <Text style={styles.captionText}>{last.body}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.foot, { justifyContent: 'flex-start', gap: spacing.sm }]}>
        {by ? <Avatar person={by} size={26} /> : null}
        <Text style={styles.footText}>{nameOf(last.author_id)}</Text>
        <Text style={styles.muted}>{timeOf(last.created_at)}</Text>
        {posts.length > 1 ? <Text style={[styles.muted, { marginLeft: 'auto' }]}>{posts.length} today</Text> : null}
      </View>
    </View>
  );
}

function EventCard({ coop, event, peopleById }: { coop: CoopSummary; event: EventSummary | undefined; peopleById: Map<string, Person> | undefined }) {
  const link = (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/circle/${coop.id}/events`)} style={styles.evLink}>
      <Text style={styles.evLinkText}>📅 see all events</Text>
    </Pressable>
  );
  if (!event) {
    return (
      <View style={[styles.fill, styles.evPad]}>
        <Text style={styles.label}>up next</Text>
        <Text style={[styles.evTitle, { marginTop: spacing.md }]}>nothing planned yet</Text>
        <Text style={styles.muted}>plan something from the events page</Text>
        <View style={{ marginTop: 'auto' }}>{link}</View>
      </View>
    );
  }
  const d = new Date(event.starts_at);
  const going = event.people.filter((p) => !p.opted_out);
  return (
    <View style={[styles.fill, styles.evPad]}>
      <Text style={styles.label}>up next</Text>
      <View style={styles.evDate}>
        <Text style={styles.evDay}>{d.getDate()}</Text>
        <Text style={styles.evDow}>
          {DOW[d.getDay()]}
          {'\n'}
          {MON[d.getMonth()]}
        </Text>
      </View>
      <Pressable onPress={() => router.push(`/event/${event.id}`)}>
        <Text style={styles.evTitle}>{event.title}</Text>
        <Text style={styles.muted}>
          {timeOf(event.starts_at)}
          {event.location ? ` at ${event.location}` : ''}
        </Text>
      </Pressable>
      <View style={styles.going}>
        {going.slice(0, 4).map((p, i) => {
          const person = peopleById?.get(p.user_id);
          return person ? (
            <View key={p.user_id} style={{ marginLeft: i ? -8 : 0, borderRadius: 16, borderWidth: 2, borderColor: colors.surface }}>
              <Avatar person={person} size={26} />
            </View>
          ) : null;
        })}
        <Text style={styles.muted}>{going.length} going</Text>
      </View>
      <View style={{ marginTop: 'auto' }}>{link}</View>
    </View>
  );
}

/** The next event in each coop (soonest first). */
export function nextEventByCoop(events: EventSummary[] | undefined): Map<string, EventSummary> {
  const m = new Map<string, EventSummary>();
  for (const e of [...(events ?? [])].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))) {
    if (!isPast(e) && !m.has(e.circle_id)) m.set(e.circle_id, e);
  }
  return m;
}

// ---------- sunny sunday: one tile per coop ----------

export function SundayTile({ coop, nameOf }: { coop: CoopSummary; nameOf: NameOf }) {
  const egg = useSundayEgg(coop.id);
  const e = egg.data;
  let art: ReactNode = <Egg size={64} swatch="shell" />;
  let line = 'no pairs yet this week';
  let sub = 'check back on sunday';
  if (e) {
    const to = nameOf(e.sendTo);
    if (e.iSent && e.theySent) {
      art = <Egg size={64} swatch="butter" pattern="dots" />;
      line = 'you have an egg!';
      sub = 'tap to crack!';
    } else if (e.iSent) {
      art = <Pan size={78} />;
      line = 'still frying!';
      sub = `waiting on ${nameOf(e.fromId ?? e.sendTo)}`;
    } else if (e.theySent) {
      art = <Egg size={64} swatch="blush" pattern="stripes" />;
      line = 'an egg is waiting for you';
      sub = `send ${to} yours to open it`;
    } else {
      art = <Egg size={64} swatch="shell" />;
      line = `send ${to} an egg`;
      sub = e.prompt;
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/circle/${coop.id}/sunday`)}
      style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={styles.tileArt}>{art}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{coop.name}</Text>
        <Text style={styles.tileLine}>{line}</Text>
        <Text style={styles.muted} numberOfLines={2}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- the fried egg at the bottom ----------

export function BottomEgg({ label, onPress, ready }: { label: string; onPress: () => void; ready: boolean }) {
  const { width } = useWindowDimensions();
  const w = Math.min(300, width * 0.75);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.bottomEgg, { width: w, marginLeft: -w / 2 }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <View style={[styles.beWhite, { width: w, height: w * 0.42, borderRadius: w }]}>
        <View style={[styles.beYolk, { width: w * 0.5, height: w * 0.22 }, !ready && { backgroundColor: palette.yolkHi }]}>
          <Text style={styles.beLabel}>{label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------- corner menu ----------

export interface MenuItem {
  key: string;
  icon: string;
  label: string;
  current?: boolean;
  onPress: () => void;
}

export function CornerMenu({ open, onClose, items, top }: { open: boolean; onClose: () => void; items: MenuItem[]; top: number }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="close menu">
        <View style={[styles.menu, { marginTop: top }]}>
          <View style={styles.menuYolk} />
          {items.map((it) =>
            it.key.startsWith('hr') ? (
              <View key={it.key} style={styles.hr} />
            ) : (
              <Pressable
                key={it.key}
                accessibilityRole="button"
                accessibilityState={{ selected: !!it.current }}
                onPress={() => {
                  onClose();
                  setTimeout(it.onPress, 180);
                }}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.menuIcon}>{it.icon}</Text>
                <Text style={[styles.menuText, it.current && styles.menuCurrent]}>{it.label}</Text>
              </Pressable>
            ),
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

/** Dropdown under the home title: every coop, plus add / join. */
export function CoopList({
  open,
  onClose,
  coops,
  top,
  nameOf,
  myId,
}: {
  open: boolean;
  onClose: () => void;
  coops: CoopSummary[];
  top: number;
  nameOf: NameOf;
  myId: string | null;
}) {
  const go = (to: string) => {
    onClose();
    setTimeout(() => router.push(to as never), 150);
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <View style={[styles.glist, { marginTop: top }]}>
          <Pressable accessibilityRole="button" onPress={() => go('/coop/new')} style={styles.glAdd}>
            <Text style={styles.glPlus}>＋</Text>
            <Text style={styles.glAddText}>add coop</Text>
          </Pressable>
          {coops.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => go(`/circle/${c.id}/coop`)} style={({ pressed }) => [styles.glRow, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.glName}>{c.name}</Text>
                <Text style={styles.muted}>
                  {c.members === 2 ? '1:1' : `${c.members} eggs`} ·{' '}
                  {c.today_user_id === myId ? "it's your day" : c.today_user_id ? `${nameOf(c.today_user_id)}'s day` : 'quiet today'}
                </Text>
              </View>
              <Text style={styles.streak}>🥚 {c.streak}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => go('/coop/join')} style={styles.glJoin}>
            <Text style={styles.glJoinText}>join with a code</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  group: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  gName: { ...type.title, color: colors.text, textAlign: 'center' },
  card: {
    ...shadow.card,
    position: 'absolute',
    left: 6,
    top: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  photo: { flex: 1, margin: 10, marginBottom: 0, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footText: { ...type.body, ...weight('700'), color: colors.text },
  underline: { textDecorationLine: 'underline', textDecorationColor: colors.primary },
  streak: { ...type.caption, ...weight('700'), color: colors.text, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, overflow: 'hidden' },
  muted: { ...type.caption, color: colors.textMuted },
  label: { ...type.label, color: colors.textSecondary, textTransform: 'lowercase' },
  emptyText: { ...type.heading, color: colors.text },
  caption: { position: 'absolute', left: 10, bottom: 10, right: 10, alignItems: 'flex-start' },
  captionText: { ...type.caption, ...weight('700'), color: colors.text, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, overflow: 'hidden' },
  badge: { position: 'absolute', right: -2, top: -10, alignItems: 'center' },
  tick: { position: 'absolute', top: 6, fontSize: 12, ...weight('900'), color: colors.text },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.line },
  dotOn: { backgroundColor: palette.ink, width: 18 },
  evPad: { padding: spacing.xl, gap: spacing.xs },
  evDate: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  evDay: { fontSize: 56, ...weight('800'), color: colors.text, lineHeight: 60 },
  evDow: { ...type.caption, ...weight('700'), color: colors.textSecondary },
  evTitle: { ...type.title, color: colors.text },
  going: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  evLink: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.pill, borderWidth: 1.5, borderColor: palette.ink },
  evLinkText: { ...type.caption, ...weight('700'), color: colors.text },
  tile: { ...shadow.card, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  tileArt: { width: 96, alignItems: 'center', justifyContent: 'center', minHeight: 90 },
  tileLine: { ...type.heading, color: colors.text },
  bottomEgg: { position: 'absolute', bottom: -18, left: '50%', alignItems: 'center' },
  beWhite: { ...shadow.card, backgroundColor: colors.eggWhite, borderWidth: 2.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 14 },
  beYolk: { backgroundColor: colors.yolk, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, borderWidth: 2.5, borderColor: '#A8721F', alignItems: 'center', justifyContent: 'center' },
  beLabel: { ...type.caption, ...weight('800'), color: colors.text },
  scrim: { flex: 1, backgroundColor: 'rgba(31,41,69,0.25)' },
  menu: { ...shadow.card, marginLeft: spacing.md, alignSelf: 'flex-start', minWidth: 230, paddingTop: 56, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, borderRadius: 120, borderTopLeftRadius: 60, backgroundColor: colors.eggWhite, borderWidth: 2.5, borderColor: palette.ink },
  menuYolk: { position: 'absolute', left: 18, top: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.yolk, borderWidth: 2.5, borderColor: '#A8721F' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm },
  menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  menuText: { ...type.body, ...weight('600'), color: colors.text },
  menuCurrent: { ...weight('800'), textDecorationLine: 'underline', textDecorationColor: colors.primary },
  hr: { height: 1.5, backgroundColor: palette.hair, marginVertical: spacing.xs, marginHorizontal: spacing.sm },
  glist: { ...shadow.card, marginHorizontal: spacing.lg, padding: spacing.md, gap: spacing.xs, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: palette.ink },
  glAdd: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.ink3 },
  glPlus: { ...type.heading, color: colors.text },
  glAddText: { ...type.body, ...weight('700'), color: colors.text },
  glRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  glName: { ...type.heading, color: colors.text },
  glJoin: { alignItems: 'center', padding: spacing.md },
  glJoinText: { ...type.caption, ...weight('700'), color: colors.textSecondary, textDecorationLine: 'underline' },
});
