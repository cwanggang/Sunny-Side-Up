import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CHAT_LENGTHS,
  chatClosesAt,
  chatOpen,
  isPast,
  pickPhotos,
  useAddGuestToCoop,
  useAddPhotos,
  useCoop,
  useCoopPeople,
  useEvent,
  useEventMessages,
  useEventPeople,
  useEventPhotos,
  useSendEventMessage,
  useSession,
  useSetChatTimer,
  useSetEventPerson,
  useSetOptOut,
  type EventPerson,
  type EventRole,
  type EventRow,
} from '@/api';
import { Body, Button } from '@/components';
import { Avatar, AvatarStack, KV, Segmented } from '@/components/Coop';
import { fmtLong, fmtShort, fmtTime } from '@/components/EventsView';
import { Masonry } from '@/components/Gallery';
import { colors, palette, radii, spacing, type, weight } from '@/theme';

const TABS = ['details', 'chat', 'people', 'gallery'] as const;
type Tab = (typeof TABS)[number];
const ROLE_ORDER: EventRole[] = ['edit', 'view', 'comment'];

function relWhen(d: Date) {
  const h = (d.getTime() - Date.now()) / 3600_000;
  if (h < 1) return 'in under an hour';
  if (h < 24) return `in ${Math.round(h)} hours`;
  const n = Math.round(h / 24);
  return n === 1 ? 'tomorrow' : `in ${n} days`;
}

// Design v0.4 one event (Developer B): details, temporary chat, people (roles, guests), album.
export default function EventScreen() {
  const { eventId, tab: initial } = useLocalSearchParams<{ eventId: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : 'details');
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const event = useEvent(eventId);
  const people = useEventPeople(eventId);
  const coop = useCoop(event.data?.circle_id ?? '');
  const optOut = useSetOptOut();

  const e = event.data;
  const me = people.data?.find((p) => p.userId === myId);
  const out = !!me?.optedOut;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding" keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: coop?.name ?? 'event',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.head}>
        <Text style={styles.kicker}>{coop?.name ?? ''} · event</Text>
        <Text style={styles.title}>{e?.title ?? ' '}</Text>
        {e && isPast(e) ? (
          <Text style={styles.kicker}>this event already happened</Text>
        ) : me ? (
          <Pressable accessibilityRole="button" onPress={() => optOut.mutate({ eventId, out: !out })} style={[styles.optout, out && styles.backIn]}>
            <Text style={styles.optoutText}>{out ? 'you opted out. rejoin?' : '× opt out'}</Text>
          </Pressable>
        ) : null}
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
      {event.error ? <Body error>{event.error.message}</Body> : null}
      {e ? (
        tab === 'details' ? (
          <Details e={e} people={people.data ?? []} me={me} />
        ) : tab === 'chat' ? (
          <Chat e={e} people={people.data ?? []} me={me} myId={myId} />
        ) : tab === 'people' ? (
          <People e={e} people={people.data ?? []} me={me} myId={myId} />
        ) : (
          <Album e={e} />
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Details({ e, people, me }: { e: EventRow; people: EventPerson[]; me?: EventPerson }) {
  const start = new Date(e.starts_at);
  const going = people.filter((p) => !p.optedOut);
  const leads = people.filter((p) => p.isLead);
  return (
    <ScrollView contentContainerStyle={styles.panel}>
      <KV k="date">{fmtLong(start)}</KV>
      <KV k="time">{fmtTime(start)}</KV>
      <KV k="location">{e.location || 'not set yet'}</KV>
      <KV k="people">
        <AvatarStack people={going} label={`${going.length} going`} />
      </KV>
      {e.description ? <KV k="description">{e.description}</KV> : null}
      <KV k="event lead">{leads.map((l) => `@${l.username}`).join('  ')}</KV>
      <KV k="you">{me ? (me.isLead ? 'lead this event' : `can ${me.role}`) : 'can view'}</KV>
      <KV k="chat">{!e.chat_enabled ? 'off for this event' : chatOpen(e) ? `open until ${fmtShort(chatClosesAt(e))}` : 'closed'}</KV>
    </ScrollView>
  );
}

function Chat({ e, people, me, myId }: { e: EventRow; people: EventPerson[]; me?: EventPerson; myId: string | null }) {
  const messages = useEventMessages(e.id);
  const send = useSendEventMessage();
  const timer = useSetChatTimer();
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const byId = new Map(people.map((p) => [p.userId, p]));
  const open = chatOpen(e);
  const end = chatClosesAt(e);
  const going = people.filter((p) => !p.optedOut);
  const isLead = !!me?.isLead;

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.data?.length]);

  if (!e.chat_enabled) return <Body muted>the chat is off for this event.</Body>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.chatTop}>
        <Text style={[styles.ttl, !open && { color: colors.textMuted }]}>
          {open
            ? `⏱ temporary chat. it closes ${relWhen(end)}, on ${fmtShort(end)} at ${fmtTime(end)}.`
            : `🔒 this chat closed on ${fmtShort(end)}. you can still read it.`}
        </Text>
        <View style={styles.chatRow2}>
          <AvatarStack people={going.slice(0, 5)} label={`${going.length} ${going.length === 1 ? 'person' : 'people'} in this chat`} />
          {open && isLead ? (
            <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={styles.smallChip}>
              <Text style={styles.smallChipText}>⏱ set timer</Text>
            </Pressable>
          ) : null}
        </View>
        {open && !isLead ? (
          <Text style={styles.note}>only {people.filter((p) => p.isLead).map((p) => `@${p.username}`).join(' and ')} can change how long it stays open</Text>
        ) : null}
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.msgs}>
        {messages.data?.length === 0 ? <Body muted>no messages yet. say hi!</Body> : null}
        {messages.data?.map((m) => {
          const mine = m.sender_id === myId;
          const who = byId.get(m.sender_id);
          return (
            <View key={m.id} style={[styles.msg, mine && styles.msgMe]}>
              {!mine && who ? <Avatar person={who} size={26} /> : null}
              <View style={[styles.bubble, mine && styles.bubbleMe]}>
                {!mine ? <Text style={styles.who}>{who?.username ?? 'someone'}</Text> : null}
                <Text style={styles.msgText}>{m.body}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {!open ? (
        <Text style={styles.closedBar}>this chat is closed</Text>
      ) : !me || me.optedOut ? (
        <Text style={styles.closedBar}>{me?.optedOut ? "you opted out, so you've left this chat" : "you're not on this event"}</Text>
      ) : (
        <View style={styles.bar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="type here..."
            placeholderTextColor={colors.textMuted}
            maxLength={300}
            style={styles.input}
            onSubmitEditing={() => {
              if (text.trim()) send.mutate({ eventId: e.id, body: text }, { onSuccess: () => setText('') });
            }}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="send"
            disabled={!text.trim() || send.isPending}
            onPress={() => send.mutate({ eventId: e.id, body: text }, { onSuccess: () => setText('') })}
            style={styles.sendBtn}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      )}
      {send.error ? <Body error>{send.error.message}</Body> : null}

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.scrim} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>how long should the chat stay open?</Text>
            <Text style={styles.note}>only event leads can change this. everyone in the chat sees when it closes.</Text>
            {CHAT_LENGTHS.map((c) => (
              <Pressable
                key={c.days}
                accessibilityRole="button"
                onPress={() => timer.mutate({ eventId: e.id, days: c.days }, { onSuccess: () => setPicking(false) })}
                style={styles.opt}
              >
                <Text style={styles.optText}>{c.label}</Text>
                {e.chat_days_after === c.days ? <Text style={styles.optText}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function People({ e, people, me, myId }: { e: EventRow; people: EventPerson[]; me?: EventPerson; myId: string | null }) {
  const coop = useCoop(e.circle_id);
  const members = useCoopPeople(e.circle_id);
  const setPerson = useSetEventPerson();
  const addToCoop = useAddGuestToCoop();
  const memberIds = new Set((members.data ?? []).map((m) => m.id));
  const isLead = !!me?.isLead;
  return (
    <ScrollView contentContainerStyle={styles.panel}>
      {people.map((p) => {
        const inCoop = memberIds.has(p.userId);
        return (
          <View key={p.userId} style={[styles.person, p.optedOut && { opacity: 0.5 }]}>
            <Avatar person={p} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pName}>{p.userId === myId ? 'you' : p.username}</Text>
              <Text style={styles.note}>{p.optedOut ? 'opted out' : inCoop || members.isPending ? 'going' : `not in ${coop?.name ?? 'the coop'} yet`}</Text>
            </View>
            {!inCoop && !members.isPending && isLead ? (
              <Pressable accessibilityRole="button" onPress={() => addToCoop.mutate({ eventId: e.id, userId: p.userId })} style={styles.smallChip}>
                <Text style={styles.smallChipText}>add to group</Text>
              </Pressable>
            ) : null}
            {p.isLead ? (
              <View style={[styles.role, styles.roleLead]}>
                <Text style={styles.roleText}>lead</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.username} can ${p.role}${isLead ? ', tap to change' : ''}`}
                disabled={!isLead}
                onPress={() =>
                  setPerson.mutate({ eventId: e.id, userId: p.userId, role: ROLE_ORDER[(ROLE_ORDER.indexOf(p.role) + 1) % 3] })
                }
                style={styles.role}
              >
                <Text style={styles.roleText}>can {p.role}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <Text style={styles.note}>
        {isLead ? 'you lead this event, so you can tap a role to change it. ' : ''}
        people who came but aren&apos;t in {coop?.name ?? 'the coop'} can be added to it after the event.
      </Text>
      {setPerson.error ? <Body error>{setPerson.error.message}</Body> : null}
      {addToCoop.error ? <Body error>{addToCoop.error.message}</Body> : null}
    </ScrollView>
  );
}

function Album({ e }: { e: EventRow }) {
  const photos = useEventPhotos(e.id);
  const add = useAddPhotos();
  if (!e.gallery_enabled) return <Body muted>the gallery is off for this event.</Body>;
  return (
    <ScrollView contentContainerStyle={styles.panel}>
      <View style={styles.galHead}>
        <Text style={styles.note}>{photos.data?.length ?? 0} photos</Text>
        <Button
          label="+ add photos"
          loading={add.isPending}
          onPress={async () => {
            const picked = await pickPhotos();
            if (picked.length) add.mutate({ circleId: e.circle_id, eventId: e.id, photos: picked });
          }}
        />
      </View>
      {add.error ? <Body error>{add.error.message}</Body> : null}
      {photos.data?.length ? <Masonry photos={photos.data} /> : <Body muted>no photos yet. add the first ones!</Body>}
      <Button variant="secondary" label="back to events" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  head: { padding: spacing.lg, gap: spacing.sm },
  kicker: { ...type.label, color: colors.textSecondary },
  title: { ...type.display, color: colors.text },
  optout: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.text },
  backIn: { backgroundColor: colors.primarySoft },
  optoutText: { ...type.caption, ...weight('700'), color: colors.text },
  panel: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  chatTop: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  ttl: { ...type.caption, ...weight('600'), color: colors.text },
  chatRow2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { ...type.caption, color: colors.textMuted },
  msgs: { padding: spacing.lg, gap: spacing.sm },
  msg: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '85%' },
  msgMe: { alignSelf: 'flex-end' },
  bubble: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  bubbleMe: { backgroundColor: colors.primary },
  who: { ...type.label, color: colors.textSecondary },
  msgText: { ...type.body, color: colors.text },
  bar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.surfaceAlt },
  input: { flex: 1, ...type.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { ...type.heading, color: colors.primaryText },
  closedBar: { ...type.caption, textAlign: 'center', color: colors.textMuted, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceAlt },
  smallChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.surface },
  smallChipText: { ...type.caption, ...weight('600'), color: colors.text },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl },
  sheetTitle: { ...type.heading, color: colors.text },
  opt: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  optText: { ...type.body, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pName: { ...type.body, ...weight('700'), color: colors.text },
  role: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt },
  roleLead: { backgroundColor: colors.primarySoft },
  roleText: { ...type.caption, ...weight('600'), color: colors.text },
  galHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
