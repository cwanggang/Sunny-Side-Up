import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCoop,
  useCoopPeople,
  useDeleteSnipe,
  useDemoSkipEggWar,
  useEggWar,
  useEggWarSnipes,
  useJoinEggWar,
  useLeaveEggWar,
  useMediaUrls,
  useSession,
  useStartEggWar,
  useVoteEggWar,
} from '@/api';
import { afterReply } from '@/dom/defer';
import EggWarView from '@/dom/EggWarView';
import { colors } from '@/theme';

/** The demo coop from Developer B's seed; only it gets the "demo: skip" links (the RPC checks too). */
export const DEMO_COOP_ID = '00000000-0000-4000-9000-0000000000d0';

/**
 * play! / egg war screen (the prototype's v-play and v-war). `mode="play"` is the landing page;
 * starting or joining replaces it with the war page, like the prototype's openWar({ replace: true }).
 */
export function EggWarScreen({ circleId, mode }: { circleId: string; mode: 'play' | 'war' }) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const coop = useCoop(circleId);
  const peopleQ = useCoopPeople(circleId);
  const status = useEggWar(circleId);
  const war = status.data?.war ?? null;
  const snipesQ = useEggWarSnipes(war?.state === 'live' ? war.id : null);

  const start = useStartEggWar(circleId);
  const vote = useVoteEggWar(circleId);
  const join = useJoinEggWar(circleId);
  const leave = useLeaveEggWar(circleId);
  const skip = useDemoSkipEggWar(circleId);
  const del = useDeleteSnipe(circleId);

  const urls = useMediaUrls([...(peopleQ.data ?? []).map((p) => p.avatarPath), ...(snipesQ.data ?? []).map((s) => s.media_path)]);
  const people = useMemo(
    () => (peopleQ.data ?? []).map((p) => ({ id: p.id, username: p.username || p.name.toLowerCase(), photoUrl: p.avatarPath ? (urls[p.avatarPath] ?? null) : null })),
    [peopleQ.data, urls],
  );
  const snipes = useMemo(
    () =>
      (snipesQ.data ?? []).map((s) => ({
        id: s.id,
        by: s.sniper_id,
        target: s.target_id,
        caption: s.caption,
        imgUrl: urls[s.media_path] ?? null,
        at: s.created_at,
      })),
    [snipesQ.data, urls],
  );

  const fail = (e: Error) => Alert.alert('egg war', e.message.toLowerCase());
  const toWar = () => (mode === 'play' ? afterReply(() => router.replace(`/circle/${circleId}/war`)) : undefined);

  if (!status.data || !coop) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EggWarView
        mode={mode}
        coopName={coop.name.toLowerCase()}
        me={me}
        status={status.data}
        people={people}
        snipes={snipes}
        demo={circleId === DEMO_COOP_ID}
        top={insets.top}
        onBack={async () => afterReply(() => router.back())}
        onStart={async () => start.mutate(undefined, { onSuccess: toWar, onError: fail })}
        onJoin={async () => {
          if (war && war.state === 'live') join.mutate({ warId: war.id }, { onSuccess: toWar, onError: fail });
          else toWar();
        }}
        onLeave={async () => {
          if (war) leave.mutate({ warId: war.id }, { onError: fail });
        }}
        onVote={async (choice) => {
          if (war) vote.mutate({ warId: war.id, choice }, { onError: fail });
        }}
        onSkip={async () => {
          if (war) skip.mutate({ warId: war.id }, { onError: fail });
        }}
        onDeleteSnipe={async (snipeId) => del.mutate({ snipeId }, { onError: fail })}
        onAgain={async () => start.mutate(undefined, { onError: fail })}
        onSnipe={async () => {
          if (war?.state === 'live') router.push(`/camera?mode=snipe&circleId=${circleId}&warId=${war.id}`);
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
