import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newLocalId, setPendingCarry, useCircleMembers, useCoop, usePostDailyPhoto, useSendChickEgg, useSendSundayEgg, useSundayEgg } from '@/api';
import { afterReply } from '@/dom/defer';
import EggDecorator from '@/dom/EggDecorator';
import { colors } from '@/theme';

// "decorate it!": the prototype's egg decorator, then deliver. `media` is the voice memo or photo.
//   sunny sunday: the egg flies off, back to the tile (still frying).
//   the chick (`to`): back home, where the chick runs off carrying it.
//   today's photo (`daily=1`): posts the decorated photo to the coop, then back to today's photo.
export default function DecorateScreen() {
  const { id, media, to, nudge, from, daily } = useLocalSearchParams<{
    id: string;
    media?: string;
    to?: string;
    nudge?: string;
    from?: string;
    daily?: string;
  }>();
  const isDaily = daily === '1';
  const coop = useCoop(id);
  const postDaily = usePostDailyPhoto();
  const insets = useSafeAreaInsets();
  const egg = useSundayEgg(to || isDaily ? '' : id);
  const members = useCircleMembers(id);
  const sendSunday = useSendSundayEgg();
  const sendChick = useSendChickEgg();
  const style = useRef({ swatch: 'butter', pattern: 'dots' });
  const e = egg.data;
  const whoId = to ?? e?.sendTo;
  const name = isDaily
    ? (coop?.name ?? 'your coop').toLowerCase()
    : (members.data?.find((m) => m.userId === whoId)?.displayName ?? 'your person').toLowerCase();
  const kind = media ? (media.toLowerCase().endsWith('.m4a') ? 'voice memo' : 'photo') : 'egg';
  if (!to && !isDaily && !e) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EggDecorator
        kindLabel={isDaily ? `today's photo for <b>${name.replace(/</g, '')}</b>` : `${kind} for <b>${name.replace(/</g, '')}</b>`}
        partnerName={name}
        top={insets.top}
        quick={!!to}
        onBack={async () => afterReply(() => router.back())}
        onDeliver={async (s) => {
          style.current = { swatch: s.swatch, pattern: s.pattern };
          if (isDaily) {
            await postDaily.mutateAsync({
              circleId: id,
              body: s.text,
              eggStyle: { swatch: s.swatch, pattern: s.pattern },
              photoUri: media || null,
            });
          } else if (to) {
            await sendChick.mutateAsync({
              circleId: id,
              recipientId: to,
              body: s.text,
              mediaUri: media || null,
              nudgeId: nudge || null,
              eggStyle: { swatch: s.swatch, pattern: s.pattern },
            });
          } else if (e) {
            await sendSunday.mutateAsync({
              circleId: id,
              egg: e,
              body: s.text,
              eggStyle: { swatch: s.swatch, pattern: s.pattern },
              mediaUri: media || null,
            });
          }
        }}
        onDelivered={async () => {
          if (to) setPendingCarry({ id: newLocalId(), to: name, egg: style.current });
          afterReply(() => {
            // Back to where this started: home, or the Sunday screen's tile, which pops to "still frying".
            if (isDaily) router.dismissTo(`/circle/${id}/spotlight`);
            else if (to || from === 'home') router.dismissTo('/circles');
            else router.dismissTo(`/circle/${id}/sunday`);
          });
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
