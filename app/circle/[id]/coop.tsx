import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { inviteMessage, useCoop, useCoopPeople, useEggWar, useLeaveCoop, useMediaUrl, useSession } from '@/api';
import { afterReply } from '@/dom/defer';
import CoopPage from '@/dom/CoopPage';
import { colors } from '@/theme';

function warCountdown(endIso: string | null) {
  const ms = Math.max(0, Date.parse(endIso ?? '') - Date.now());
  const days = ms / 864e5;
  if (days >= 1) return `${Math.ceil(days)} ${Math.ceil(days) === 1 ? 'day' : 'days'} left`;
  const h = Math.floor(ms / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// A coop's carton page: the prototype's whole page in src/dom/CoopPage.tsx.
export default function CoopScreen() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coop = useCoop(id);
  const peopleQ = useCoopPeople(id);
  const status = useEggWar(id);
  const leave = useLeaveCoop();

  const mine = peopleQ.data?.find((p) => p.id === myId);
  const avatar = useMediaUrl(mine?.avatarPath ?? null);
  const members = useMemo(() => (peopleQ.data ?? []).map((m) => m.id), [peopleQ.data]);
  const people = useMemo(
    () =>
      Object.fromEntries(
        (peopleQ.data ?? []).map((m) => [
          m.id,
          {
            username: m.username || m.name.toLowerCase(),
            egg: { swatch: m.egg.swatch || 'shell', pattern: !m.egg.pattern || m.egg.pattern === 'none' ? 'plain' : m.egg.pattern },
          },
        ]),
      ),
    [peopleQ.data],
  );
  const me = useMemo(
    () => (mine ? { id: myId, username: mine.username, photoUrl: avatar.data ?? null } : null),
    [myId, mine?.username, avatar.data], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const w = status.data?.war;
  const war =
    w && (w.state === 'vote' || w.state === 'live')
      ? {
          state: w.state,
          text: warCountdown(w.state === 'vote' ? w.vote_ends_at : w.live_ends_at),
          inIt: w.people.some((p) => p.user_id === myId && p.choice === 'in'),
        }
      : null;

  if (!coop) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CoopPage
        top={insets.top}
        name={coop.name}
        code={coop.invite_code}
        description={coop.description}
        me={me}
        members={members}
        people={people}
        war={war}
        welcome={welcome === '1'}
        onBack={async () => afterReply(() => router.back())}
        onMember={async (uid) => router.push(`/member/${uid}?circleId=${id}`)}
        onProfile={async () => router.push('/profile')}
        onNav={async (to) => router.push(`/circle/${id}/${to}` as never)}
        onInvite={async () => {
          await Share.share({ message: inviteMessage(coop) });
        }}
        onSnipe={async () => {
          if (w?.state === 'live') router.push(`/camera?mode=snipe&circleId=${id}&warId=${w.id}`);
        }}
        onLeave={async () =>
          leave.mutate({ circleId: id }, { onSuccess: () => afterReply(() => router.replace('/circles')), onError: (e) => Alert.alert('leave', e.message.toLowerCase()) })
        }
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
