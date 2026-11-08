import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCoops, useEvents, usePeople, useSession } from '@/api';
import { Body } from '@/components';
import { Avatar, EggButton } from '@/components/Coop';
import { FriedEgg } from '@/components/Egg';
import { BottomEgg, CoopList, CoopStack, CornerMenu, SundayTile, nextEventByCoop, type MenuItem } from '@/components/Home';
import { colors, palette, spacing, type } from '@/theme';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const kicker = (d: Date) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;

// Design v0.5 home (A5.2, handed to Developer B): "my coops" on weekdays, "sunny sunday!" on
// Sundays (switch from the corner menu). Each coop is a stack of cards: coop photo + whose day,
// today's photo, up next. The fried egg at the bottom opens the camera on your day.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const coops = useCoops();
  const people = usePeople();
  const events = useEvents(null);
  const [mode, setMode] = useState<'weekday' | 'sunday'>(() => (new Date().getDay() === 0 ? 'sunday' : 'weekday'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const peopleById = people.data?.people;
  const me = myId ? peopleById?.get(myId) : undefined;
  const nameOf = (id: string | null | undefined) =>
    !id ? 'someone' : id === myId ? 'you' : (peopleById?.get(id)?.username ?? 'a friend');
  const list = coops.data ?? [];
  const nextEvents = nextEventByCoop(events.data);
  const myDays = list.filter((c) => c.today_user_id === myId);
  const left = myDays.filter((c) => !c.today_posted);
  const sunday = mode === 'sunday';

  const refresh = () => {
    void coops.refetch();
    void events.refetch();
  };

  const menu: MenuItem[] = [
    { key: 'weekday', icon: '🏠', label: 'my coops', current: !sunday, onPress: () => setMode('weekday') },
    { key: 'sunday', icon: '☀️', label: 'sunny sunday', current: sunday, onPress: () => setMode('sunday') },
    { key: 'calendar', icon: '📅', label: 'calendar', onPress: () => router.push('/calendar') },
    { key: 'nudges', icon: '💛', label: 'nudges', onPress: () => router.push('/nudges') },
    { key: 'settings', icon: '⚙️', label: 'settings', onPress: () => router.push('/settings') },
    { key: 'hr1', icon: '', label: '', onPress: () => {} },
    { key: 'demo', icon: '🎬', label: 'demo controls', onPress: () => router.push('/demo') },
  ];

  function onEgg() {
    if (left.length) return router.push('/camera');
    if (myDays.length) return Alert.alert('all done today', "you've posted everywhere it's your day. nice!");
    const next = list.find((c) => c.today_user_id);
    Alert.alert('not your day yet', next ? `today is ${nameOf(next.today_user_id)}'s day in ${next.name}. react to their photo!` : 'no one is up today.');
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: sunday ? spacing.xxl + insets.bottom : 200 }]}
        refreshControl={<RefreshControl refreshing={coops.isRefetching} onRefresh={refresh} />}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="show my coops" onPress={() => setListOpen(true)} style={styles.titleBtn}>
          <Text style={styles.title}>{sunday ? 'sunny sunday!' : 'my coops'}</Text>
          <Text style={styles.chev}>⌄</Text>
        </Pressable>
        <Text style={styles.kicker}>{kicker(new Date())}</Text>

        {coops.error ? <Body error>couldn&apos;t load your coops: {coops.error.message}</Body> : null}
        {coops.isPending ? <Body muted>cracking eggs…</Body> : null}
        {coops.data?.length === 0 ? (
          <View style={styles.empty}>
            <FriedEgg size={120} />
            <Body muted>no coops yet. make one for your people, or join with a code.</Body>
            <EggButton label="add a coop" onPress={() => router.push('/coop/new')} />
            <Pressable onPress={() => router.push('/coop/join')}>
              <Text style={styles.link}>join with a code</Text>
            </Pressable>
          </View>
        ) : null}

        {sunday ? (
          <View style={styles.tiles}>
            {list.map((c) => (
              <SundayTile key={c.id} coop={c} nameOf={nameOf} />
            ))}
          </View>
        ) : (
          list.map((c) => (
            <CoopStack key={c.id} coop={c} myId={myId} nameOf={nameOf} peopleById={peopleById} nextEvent={nextEvents.get(c.id)} />
          ))
        )}
      </ScrollView>

      {!sunday && list.length > 0 ? (
        <BottomEgg
          ready={left.length > 0}
          label={left.length ? "it's your day!" : myDays.length ? 'all done today' : 'not your day'}
          onPress={onEgg}
        />
      ) : null}

      {/* corners: menu egg (left), you (right) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="open menu"
        onPress={() => setMenuOpen(true)}
        style={[styles.cornerL, { top: insets.top + 4 }]}
      >
        <View style={styles.cornerWhite}>
          <View style={styles.cornerYolk} />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="your profile"
        onPress={() => router.push('/profile')}
        style={[styles.cornerR, { top: insets.top + 4 }]}
      >
        <View style={styles.cornerAvatar}>{me ? <Avatar person={me} size={40} /> : null}</View>
        <Text style={styles.handle}>@{me?.username ?? '…'}</Text>
      </Pressable>

      <CornerMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menu} top={insets.top + 4} />
      <CoopList open={listOpen} onClose={() => setListOpen(false)} coops={list} top={insets.top + 110} nameOf={nameOf} myId={myId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'stretch' },
  titleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  title: { ...type.display, fontSize: 38, color: colors.text, textAlign: 'center' },
  chev: { ...type.title, color: colors.text, marginTop: -10 },
  kicker: { ...type.label, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  link: { ...type.caption, fontWeight: '700', color: colors.textSecondary, textDecorationLine: 'underline' },
  tiles: { gap: spacing.md },
  cornerL: { position: 'absolute', left: spacing.md },
  cornerWhite: { width: 64, height: 56, borderRadius: 30, backgroundColor: colors.eggWhite, borderWidth: 2.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  cornerYolk: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.yolk, borderWidth: 2.5, borderColor: '#A8721F' },
  cornerR: { position: 'absolute', right: spacing.md, alignItems: 'center', gap: 2 },
  cornerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.eggWhite, borderWidth: 2.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  handle: { ...type.caption, fontWeight: '700', color: colors.text, backgroundColor: colors.eggWhite, paddingHorizontal: spacing.sm, borderRadius: 999, overflow: 'hidden' },
});
