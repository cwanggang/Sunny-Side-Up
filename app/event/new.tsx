import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoops, useCreateEvent, usePeople, useSession, type EventRole, type Person } from '@/api';
import { Body, Button, Chip, Screen, TextField } from '@/components';
import { Avatar } from '@/components/Coop';
import { ymd } from '@/components/Gallery';
import { colors, radii, shadow, spacing, type, weight } from '@/theme';

const ROLES: EventRole[] = ['edit', 'view', 'comment'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

interface Added {
  userId: string;
  role: EventRole;
  lead: boolean;
}

// Design v0.4 "new event" (Developer B): coop, name, who's in charge, date/time/location/description,
// people from the coop + contacts (people from my other coops) with a default role, chat + gallery.
export default function NewEventScreen() {
  const { circleId: fixed } = useLocalSearchParams<{ circleId?: string }>();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coops = useCoops();
  const people = usePeople();
  const create = useCreateEvent();

  const [circleId, setCircleId] = useState<string | null>(fixed ?? null);
  const gid = circleId ?? coops.data?.[0]?.id ?? null;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(addDays(7));
  const [time, setTime] = useState('18:00');
  const [where, setWhere] = useState('');
  const [desc, setDesc] = useState('');
  const [role, setRole] = useState<EventRole>('view');
  const [added, setAdded] = useState<Added[]>([]);
  const [chat, setChat] = useState(true);
  const [gallery, setGallery] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const all = people.data?.people;
  const coopsOf = people.data?.coopsOf;
  const addedIds = new Set(added.map((a) => a.userId));
  const others = [...(all?.values() ?? [])].filter((p) => p.id !== myId && !addedIds.has(p.id));
  const inCoop = (p: Person) => !!gid && !!coopsOf?.get(p.id)?.includes(gid);
  const fromCoop = others.filter(inCoop);
  const contacts = others.filter((p) => !inCoop(p));
  const coopName = coops.data?.find((c) => c.id === gid)?.name ?? '';
  const nameOf = (id: string) => all?.get(id)?.username ?? 'friend';

  const add = (p: Person) => setAdded((a) => [...a, { userId: p.id, role, lead: false }]);

  function save() {
    setError(null);
    if (!gid) return setError('make a coop first, then plan things with it');
    if (!title.trim()) return setError('give the event a name first');
    if (!DATE.test(date) || Number.isNaN(Date.parse(date))) return setError('date should look like 2026-11-14');
    if (!TIME.test(time)) return setError('time should look like 18:00');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    create.mutate(
      {
        circleId: gid,
        title: title.trim(),
        startsAt: new Date(y, m - 1, d, hh, mm),
        location: where,
        description: desc,
        people: added.map((a) => ({ userId: a.userId, role: a.lead ? 'edit' : a.role, lead: a.lead })),
        chat,
        gallery,
      },
      { onSuccess: (e) => router.replace(`/event/${e.id}`) },
    );
  }

  return (
    <Screen title={coopName ? `new event · ${coopName}` : 'new event'}>
      {!fixed ? (
        <>
          <Text style={styles.lbl}>for which coop?</Text>
          <View style={styles.chips}>
            {coops.data?.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === gid}
                onPress={() => {
                  setCircleId(c.id);
                  setAdded((a) => a.filter((x) => !coopsOf?.get(x.userId)?.includes(gid ?? '')));
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      <TextField label="event name" value={title} onChangeText={setTitle} maxLength={40} placeholder="event name" />

      <Text style={styles.lbl}>in charge</Text>
      <View style={styles.chips}>
        <Chip label="you" selected />
        {added.filter((a) => a.lead).map((a) => (
          <Chip key={a.userId} label={`${nameOf(a.userId)} ✕`} selected onPress={() => setAdded((l) => l.map((x) => (x.userId === a.userId ? { ...x, lead: false } : x)))} />
        ))}
      </View>
      {added.some((a) => !a.lead) ? <Body muted>tap ★ next to someone you added to put them in charge too</Body> : null}

      <Text style={styles.lbl}>date</Text>
      <View style={styles.chips}>
        {[
          ['today', 0],
          ['tomorrow', 1],
          ['in 3 days', 3],
          ['next week', 7],
        ].map(([l, n]) => (
          <Chip key={l as string} label={l as string} selected={date === addDays(n as number)} onPress={() => setDate(addDays(n as number))} />
        ))}
      </View>
      <View style={styles.two}>
        <View style={styles.flex}>
          <TextField label="date (yyyy-mm-dd)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.flex}>
          <TextField label="time (24h)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="18:00" />
        </View>
      </View>
      <TextField label="location" value={where} onChangeText={setWhere} maxLength={60} placeholder="where is it?" />
      <TextField label="description" value={desc} onChangeText={setDesc} maxLength={200} multiline placeholder="anything people should know" />

      <View style={styles.permRow}>
        <Text style={styles.lbl}>add people</Text>
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Chip key={r} label={`can ${r}`} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
      </View>
      {fromCoop.length ? (
        <Button variant="secondary" label={`add group: ${coopName} (${fromCoop.length})`} onPress={() => setAdded((a) => [...a, ...fromCoop.map((p) => ({ userId: p.id, role, lead: false }))])} />
      ) : null}
      <View style={styles.cols}>
        <View style={styles.col}>
          {fromCoop.length ? <Text style={styles.sub}>{coopName}</Text> : null}
          {fromCoop.map((p) => (
            <PersonRow key={p.id} p={p} right="+" onPress={() => add(p)} />
          ))}
          <Text style={styles.sub}>contacts</Text>
          {contacts.length ? contacts.map((p) => <PersonRow key={p.id} p={p} right="+" onPress={() => add(p)} />) : <Text style={styles.sub}>everyone is added</Text>}
        </View>
        <View style={styles.col}>
          <Text style={styles.sub}>added ({added.length + 1})</Text>
          {all?.get(myId) ? <PersonRow p={all.get(myId)!} label="you" tag="lead" /> : null}
          {added.map((a) => {
            const p = all?.get(a.userId);
            if (!p) return null;
            return (
              <PersonRow
                key={a.userId}
                p={p}
                tag={a.lead ? 'lead' : a.role}
                right="✕"
                onPress={() => setAdded((l) => l.filter((x) => x.userId !== a.userId))}
                onStar={a.lead ? undefined : () => setAdded((l) => l.map((x) => (x.userId === a.userId ? { ...x, lead: true } : x)))}
              />
            );
          })}
        </View>
      </View>

      <Text style={styles.lbl}>extras</Text>
      <View style={styles.chips}>
        <Chip label="💬 chat" selected={chat} onPress={() => setChat((v) => !v)} />
        <Chip label="🖼 gallery" selected={gallery} onPress={() => setGallery((v) => !v)} />
      </View>

      {error ? <Body error>{error}</Body> : null}
      {create.error ? <Body error>couldn&apos;t save: {create.error.message}</Body> : null}
      <Button label="save" onPress={save} loading={create.isPending} />
    </Screen>
  );
}

function PersonRow({ p, label, tag, right, onPress, onStar }: { p: Person; label?: string; tag?: string; right?: string; onPress?: () => void; onStar?: () => void }) {
  return (
    <View style={styles.pRow}>
      <Avatar person={p} size={26} />
      <Text style={styles.pName} numberOfLines={1}>
        {label ?? p.username}
      </Text>
      {tag ? <Text style={styles.tag}>{tag}</Text> : null}
      {onStar ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`put ${p.username} in charge`} onPress={onStar} hitSlop={8}>
          <Text style={styles.icon}>★</Text>
        </Pressable>
      ) : null}
      {right && onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={right === '+' ? `add ${p.username}` : `remove ${p.username}`} onPress={onPress} hitSlop={8}>
          <Text style={styles.icon}>{right}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lbl: { ...type.label, color: colors.textSecondary, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  two: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  permRow: { gap: spacing.sm },
  cols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1, gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  sub: { ...type.label, color: colors.textMuted, marginTop: spacing.xs },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 3 },
  pName: { flex: 1, ...type.caption, ...weight('600'), color: colors.text },
  tag: { ...type.label, fontSize: 10, color: colors.textMuted },
  icon: { ...type.heading, color: colors.text, paddingHorizontal: 2 },
});
