import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCoop, useCoopPeople, useDailyPrompt, useMediaUrl, usePhotoPicker, useSession, useSundayEgg, useVoicePlayer, useVoiceRecorder } from '@/api';
import { afterReply } from '@/dom/defer';
import PickPage from '@/dom/PickPage';
import { colors } from '@/theme';

// "pick one:" + the voice memo (src/dom/PickPage.tsx). Three ways in:
//   sunny sunday: your person this week
//   the chick: `?to=<friend>&nudge=<nudge id>` ("a little hello")
//   today's photo: `?daily=1` (photo only; decorate it, then it posts to the coop)
// A photo can come from the camera or from your photos.
export default function RespondScreen() {
  const { id, to, nudge, from, daily } = useLocalSearchParams<{ id: string; to?: string; nudge?: string; from?: string; daily?: string }>();
  const isDaily = daily === '1';
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const coop = useCoop(id);
  const egg = useSundayEgg(to || isDaily ? '' : id);
  const dailyPrompt = useDailyPrompt();
  const library = usePhotoPicker();
  const people = useCoopPeople(id);
  const recorder = useVoiceRecorder();
  const player = useVoicePlayer(recorder.uri);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const whoId = isDaily ? (session?.user.id ?? null) : (to ?? egg.data?.sendTo ?? null);
  const person = people.data?.find((p) => p.id === whoId);
  const photo = useMediaUrl(person?.avatarPath ?? null);
  const who = useMemo(
    () => (person ? { id: person.id, username: person.username, photoUrl: photo.data ?? null } : null),
    [person?.id, person?.username, photo.data], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!who || !coop || (!to && !isDaily && !egg.data) || !session) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const params = `${to ? `&to=${to}` : ''}${nudge ? `&nudge=${nudge}` : ''}${from ? `&from=${from}` : ''}${isDaily ? '&daily=1' : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PickPage
        top={insets.top}
        barTitle={to ? 'a little hello' : isDaily ? "today's photo" : coop.name}
        whoLabel={to ? 'an egg for' : isDaily ? `it's your day in ${coop.name.toLowerCase()}` : 'your person this week'}
        who={isDaily ? { ...who, username: 'you' } : who}
        coopName={coop.name}
        promptLabel={to ? 'a prompt, if you want one' : isDaily ? "today's prompt" : "this week's prompt"}
        prompt={
          to
            ? `tell ${who.username} about something that made you think of them`
            : isDaily
              ? (dailyPrompt.data ?? '')
              : (egg.data?.prompt ?? '')
        }
        gift={!to && !isDaily && !!egg.data?.theySent}
        voice={!isDaily}
        focused={focused}
        onBack={async () => afterReply(() => router.back())}
        onPhoto={async () => router.push(`/camera?mode=respond&circleId=${id}${params}`)}
        onLibrary={async () => {
          const uri = await library();
          if (uri) router.push(`/circle/${id}/decorate?media=${encodeURIComponent(uri)}${params}`);
        }}
        onRecord={async () => recorder.start()}
        onStop={async () => {
          await recorder.stop();
        }}
        onListen={async () => player.toggle()}
        onAgain={async () => recorder.reset()}
        onDecorate={async () => {
          if (recorder.uri) router.push(`/circle/${id}/decorate?media=${encodeURIComponent(recorder.uri)}${params}`);
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
