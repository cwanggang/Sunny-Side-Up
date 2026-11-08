import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  demoKeyConfigured,
  getPendingCarry,
  isPast,
  setPendingCarry,
  useChickMail,
  useChickNudge,
  useChickPrefs,
  useCoops,
  useEggWars,
  useEvents,
  useJoinCoop,
  useLeaveCoop,
  useMediaUrlMap,
  usePeople,
  usePhotoPicker,
  useSession,
  useSetChickPrefs,
  useSetCoopCover,
  useSpotlights,
  useSundayEggs,
  eggStyleOf,
  type EventSummary,
  type PendingCarry,
} from '@/api';
import { useLoadingEggDone } from '@/components/LoadingEgg';
import { sundayUi } from '@/components/SundayArt';
import { afterReply } from '@/dom/defer';
import HomeView, { type HomeCoopProp, type HomeMode, type SundayAct } from '@/dom/HomeView';
import { colors } from '@/theme';

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();

function nextEventByCoop(events: EventSummary[] | undefined): Map<string, EventSummary> {
  const m = new Map<string, EventSummary>();
  for (const e of [...(events ?? [])].sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))) {
    if (!isPast(e) && !m.has(e.circle_id)) m.set(e.circle_id, e);
  }
  return m;
}

// The home screen: the prototype's whole page in one DOM component (src/dom/HomeView.tsx). This file only
// gathers the data and carries out the actions.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coops = useCoops();
  const people = usePeople();
  const events = useEvents(null);
  const list = useMemo(() => coops.data ?? [], [coops.data]);
  const ids = useMemo(() => list.map((c) => c.id), [list]);

  const [mode, setMode] = useState<HomeMode>(() => (new Date().getDay() === 0 ? 'sunday' : 'weekday'));
  const [focused, setFocused] = useState(true);
  const splashDone = useLoadingEggDone();
  const [carry, setCarry] = useState<PendingCarry | null>(null);
  const [, setCrackTick] = useState(0);

  const sundays = useSundayEggs(ids, mode === 'sunday');
  const spotlights = useSpotlights(ids);
  const wars = useEggWars(ids);
  const pick = usePhotoPicker();
  const setCover = useSetCoopCover();
  const join = useJoinCoop();
  const leave = useLeaveCoop();

  const chickPrefs = useChickPrefs();
  const setChick = useSetChickPrefs();
  const nudge = useChickNudge();
  const mail = useChickMail();

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void coops.refetch();
      void events.refetch();
      setCarry(getPendingCarry());
      return () => setFocused(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const peopleById = people.data?.people;
  const lastPhoto = (id: string) => {
    const posts = spotlights[id]?.posts ?? [];
    return [...posts].reverse().find((p) => p.media_path) ?? posts[posts.length - 1] ?? null;
  };

  const urls = useMediaUrlMap([
    ...list.map((c) => c.cover_path),
    ...ids.map((id) => lastPhoto(id)?.media_path),
    ...[...(peopleById?.values() ?? [])].map((p) => p.avatarPath),
  ]);

  const domPeople = useMemo(() => {
    const out: Record<string, { id: string; username: string; name: string; photoUrl: string | null }> = {};
    peopleById?.forEach((p) => {
      out[p.id] = { id: p.id, username: p.username, name: p.name, photoUrl: p.avatarPath ? (urls[p.avatarPath] ?? null) : null };
    });
    return out;
  }, [peopleById, urls]);

  const friend = (id: string) => domPeople[id] ?? { id, username: 'a friend', photoUrl: null };

  const nextEvents = nextEventByCoop(events.data);
  const domCoops: HomeCoopProp[] = list.map((c) => {
    const photo = lastPhoto(c.id);
    const e = nextEvents.get(c.id);
    const w = wars[c.id]?.war;
    const start = e ? new Date(e.starts_at) : null;
    const egg = sundays[c.id];
    const crackKey = egg ? `${c.id}:${egg.periodKey}` : '';
    const state = !egg ? 'N' : !egg.iSent ? (sundayUi.isCracked(crackKey) ? 'B' : 'A') : !egg.theirs ? 'D' : sundayUi.isOpened(egg.theirs.id) ? 'E' : 'C';
    const partnerId = !egg ? null : state === 'A' || state === 'B' ? egg.sendTo : (egg.fromId ?? egg.sendTo);
    const partner = partnerId ? domPeople[partnerId] : null;
    return {
      id: c.id,
      name: c.name,
      members: c.members,
      today: c.today_user_id,
      coverUrl: c.cover_path ? (urls[c.cover_path] ?? null) : null,
      photo: photo ? { url: photo.media_path ? (urls[photo.media_path] ?? null) : null, by: photo.author_id, time: timeOf(photo.created_at) } : null,
      event:
        e && start
          ? {
              id: e.id,
              title: e.title,
              day: start.getDate(),
              dow: DOW[start.getDay()],
              mon: MON[start.getMonth()],
              when: `${timeOf(e.starts_at)}${e.location ? ` at ${e.location}` : ''}`,
              going: e.people.filter((p) => !p.opted_out).map((p) => p.user_id),
            }
          : null,
      war:
        w && (w.state === 'vote' || w.state === 'live')
          ? { state: w.state, label: w.state === 'live' ? `egg war in ${c.name}` : `egg war vote in ${c.name}` }
          : null,
      sunday: {
        state,
        partner: partner ? { id: partner.id, name: partner.username, photoUrl: partner.photoUrl } : null,
        theirs: egg?.theirs ? { ...eggStyleOf(egg.theirs), text: egg.theirs.body } : null,
      },
    };
  });

  const myDays = list.filter((c) => c.today_user_id === myId);
  const left = myDays.filter((c) => !c.today_posted);
  const someoneUp = list.find((c) => c.today_user_id);

  const bottom = left.length
    ? { label: "it's your day!", aria: "it's your day: add today's photo", ready: true, tip: '' }
    : myDays.length
      ? { label: 'all done today', aria: 'all done for today', ready: false, tip: "you've posted everywhere today. nice!" }
      : {
          label: 'not your day',
          aria: 'not your day',
          ready: false,
          tip: someoneUp ? `today is ${friend(someoneUp.today_user_id).username}'s day in ${someoneUp.name}` : 'no one is up today',
        };

  const n = nudge.current;
  const domNudge = n ? { id: n.id, friend: friend(n.aboutUserId), message: n.message } : null;
  const l = nudge.latest;
  const domLatest = l ? { id: l.id, friend: friend(l.aboutUserId), message: l.message } : null;
  const m = mail[0];
  const domMail = m ? { id: m.id, friend: friend(m.sender_id), egg: { ...(peopleById?.get(m.sender_id)?.egg ?? { swatch: 'butter', pattern: 'dots' }), text: m.body } } : null;

  const me = domPeople[myId] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HomeView
        top={insets.top}
        me={me}
        people={domPeople}
        coops={domCoops}
        loaded={!coops.isPending && splashDone}
        mode={mode}
        focused={focused && splashDone}
        bottom={bottom}
        demo={demoKeyConfigured}
        chick={{ on: chickPrefs.data?.on ?? true, nudge: domNudge, latest: domLatest, mail: domMail, carry }}
        onMode={async (x) => setMode(x)}
        onCoop={async (id) => router.push(`/circle/${id}/coop`)}
        onEvents={async (id) => (id ? router.push(`/circle/${id}/events`) : router.push('/calendar'))}
        onEvent={async (id) => router.push(`/event/${id}`)}
        onWar={async (id) => router.push(`/circle/${id}/war`)}
        onCover={async (id) => {
          const uri = await pick();
          if (!uri) return null;
          await setCover.mutateAsync({ circleId: id, uri });
          return '';
        }}
        onProfile={async () => router.push('/profile')}
        onRoute={async (to) => router.push(`/${to}` as never)}
        onCamera={async () => router.push('/camera')}
        onJoin={async (code) => {
          try {
            const c = await join.mutateAsync({ code });
            afterReply(() => router.push(`/circle/${c.id}/coop?welcome=1`));
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "couldn't join that coop";
          }
        }}
        onLeave={async (id) => leave.mutate({ circleId: id })}
        onSunday={async (id, act: SundayAct) => {
          if (act === 'cracked') {
            const egg = sundays[id];
            if (egg) sundayUi.markCracked(`${id}:${egg.periodKey}`);
            setCrackTick((t) => t + 1);
          } else if (act === 'respond') router.push(`/circle/${id}/respond?from=home`);
          else if (act === 'open') router.push(`/circle/${id}/reveal`);
          else router.push(`/circle/${id}/reveal?again=1`);
        }}
        onChickSend={async (x) => {
          const full = nudge.current?.id === x.id ? nudge.current : nudge.latest;
          if (!full) return;
          router.push(`/circle/${full.circleId}/respond?to=${full.aboutUserId}&nudge=${full.id}`);
        }}
        onChickOpen={async (x) => router.push(`/egg/${x.id}`)}
        onChickDismiss={async (x) => {
          setChick.mutate({ dismissed: [...(chickPrefs.data?.dismissed ?? []), x.id] });
        }}
        onChickOff={async () => setChick.mutate({ on: false })}
        onCarryDone={async () => {
          setPendingCarry(null);
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
