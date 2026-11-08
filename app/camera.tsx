import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LiveCamera,
  localImageDataUrl,
  useCameraCapture,
  useCoop,
  useCoopPeople,
  useCoops,
  useDaily,
  useDailyPrompt,
  useMediaUrlMap,
  usePhotoPicker,
  usePostDailyPhoto,
  useSession,
  useSundayEgg,
  type LiveCameraHandle,
} from '@/api';
import CameraPage from '@/dom/CameraPage';
import { afterReply } from '@/dom/defer';
import { colors, palette } from '@/theme';

type Params = {
  /** photo (default): today's photo. respond: a photo for an egg. snipe: egg war. */
  mode?: 'photo' | 'respond' | 'snipe';
  circleId?: string;
  to?: string;
  nudge?: string;
  from?: string;
  warId?: string;
  /** with mode=respond: today's photo, decorated before it posts. */
  daily?: string;
};

// The camera: the native viewfinder under the prototype's chrome (src/dom/CameraPage.tsx). Opens with no
// transition of its own: the yolk has already swollen over the screen behind it.
export default function CameraScreen() {
  const { mode = 'photo', circleId, to, nudge, from, warId, daily } = useLocalSearchParams<Params>();
  const isDaily = mode === 'respond' && daily === '1';
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';

  const coops = useCoops();
  const prompt = useDailyPrompt();
  const post = usePostDailyPhoto();
  const capture = useCameraCapture();
  const library = usePhotoPicker();
  const coop = useCoop(circleId ?? '');
  const sunday = useSundayEgg(mode === 'respond' && !to && !isDaily ? (circleId ?? '') : '');
  const people = useCoopPeople(circleId ?? '');

  const camera = useRef<LiveCameraHandle>(null);
  const shotUri = useRef<string | null>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; size: number } | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [live, setLive] = useState<boolean | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [fade] = useState(() => new Animated.Value(0));

  const myDays = useMemo(() => (coops.data ?? []).filter((c) => c.today_user_id === myId), [coops.data, myId]);
  const targets = useMemo(() => myDays.map((c) => ({ id: c.id, name: c.name, posted: c.today_posted })), [myDays]);
  const start = circleId && myDays.some((c) => c.id === circleId) ? circleId : null;
  const target = targetId ?? start ?? myDays.find((c) => !c.today_posted)?.id ?? null;

  // What sits under the top card on the "sent" page, and who can see it.
  const dailyQ = useDaily(mode === 'photo' ? (target ?? '') : '');
  const coopPeople = useCoopPeople(mode === 'photo' ? (target ?? '') : '');
  const earlier = (dailyQ.data ?? []).filter((d) => d.posted && d.media_path).slice(0, 3);
  const urls = useMediaUrlMap(earlier.map((d) => d.media_path));
  const past = useMemo(
    () =>
      earlier
        .filter((d) => urls[d.media_path])
        .slice(0, 2)
        .map((d, i) => {
          const p = coopPeople.data?.find((x) => x.id === d.user_id);
          return { url: urls[d.media_path], by: { id: d.user_id, username: p?.username ?? 'friend' }, when: i ? '2 days ago' : 'yesterday' };
        }),
    [earlier, urls, coopPeople.data],
  );
  const others = (coopPeople.data ?? []).filter((p) => p.id !== myId).map((p) => p.username);
  const noteNames = others.length > 1 ? `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}` : (others[0] ?? 'your coop');
  const me = useMemo(() => (myId ? { id: myId, username: 'you' } : null), [myId]);

  const toName = people.data?.find((p) => p.id === to)?.username;
  const label =
    mode === 'snipe'
      ? `egg war: <b>${coop?.name ?? ''}</b>`
      : isDaily
        ? `today's photo: <b>${coop?.name ?? ''}</b>`
        : `to: <b>${toName ?? people.data?.find((p) => p.id === sunday.data?.sendTo)?.username ?? 'your person'}</b>`;
  const promptLabel =
    mode === 'snipe' ? 'egg war' : isDaily ? "today's prompt" : mode === 'respond' ? (to ? 'a little hello' : "this week's prompt") : "today's prompt";
  const promptText =
    mode === 'snipe'
      ? `catch someone from ${coop?.name ?? 'your coop'} off guard. candid only!`
      : isDaily
        ? (prompt.data ?? '')
        : mode === 'respond'
        ? to
          ? `tell ${toName ?? 'them'} about something that made you think of them`
          : (sunday.data?.prompt ?? '')
        : (prompt.data ?? '');

  const reveal = () => Animated.timing(fade, { toValue: 1, duration: 400, delay: 260, useNativeDriver: true }).start();
  const keep = async (uri: string | null) => {
    if (!uri) return null;
    shotUri.current = uri;
    setReviewing(true);
    return localImageDataUrl(uri);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.yolk }}>
      {frame ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: frame.x,
            top: frame.y,
            width: frame.size,
            height: frame.size,
            borderRadius: 32,
            overflow: 'hidden',
            backgroundColor: palette.pan,
            opacity: fade,
          }}
        >
          <LiveCamera ref={camera} facing={facing} mirror={facing === 'front'} active={!reviewing} style={{ flex: 1 }} onPermission={setLive} />
        </Animated.View>
      ) : null}
      <CameraPage
        top={insets.top}
        mode={mode}
        fixedLabel={label}
        promptLabel={promptLabel}
        prompt={promptText}
        targets={targets}
        start={start}
        live={live}
        me={me}
        past={past}
        noteNames={noteNames}
        onFrame={async (f) => {
          setFrame(f);
          reveal();
        }}
        onClose={async () => afterReply(() => router.back())}
        onFlip={async () => setFacing((x) => (x === 'back' ? 'front' : 'back'))}
        onShutter={async () => keep(live === false ? await capture() : ((await camera.current?.takePhoto()) ?? null))}
        onLibrary={async () => keep(await library())}
        onRetake={async () => {
          shotUri.current = null;
          setReviewing(false);
        }}
        onSend={async (id) => {
          setTargetId(id);
          await post.mutateAsync({ circleId: id, body: '', eggStyle: { swatch: 'butter', pattern: 'none' }, photoUri: shotUri.current });
          void coops.refetch();
        }}
        onNext={async () => {
          const media = encodeURIComponent(shotUri.current ?? '');
          if (mode === 'snipe') router.push(`/circle/${circleId}/snipe?warId=${warId}&uri=${media}`);
          else
            router.push(
              `/circle/${circleId}/decorate?media=${media}${to ? `&to=${to}` : ''}${nudge ? `&nudge=${nudge}` : ''}${from ? `&from=${from}` : ''}${isDaily ? '&daily=1' : ''}`,
            );
        }}
        onHome={async () => afterReply(() => router.dismissTo('/circles'))}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: 'transparent' } }}
      />
    </View>
  );
}
