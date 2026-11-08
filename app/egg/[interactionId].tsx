import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eggStyleOf, useFriendEgg, useMediaUrl, useOpenChickEgg, usePeople, useReact } from '@/api';
import { afterReply } from '@/dom/defer';
import RevealEgg from '@/dom/RevealEgg';
import { colors } from '@/theme';

// A just-because egg the chick delivered: the same full-screen reveal as sunny sunday (prototype's
// `openEgg(gid, { from, egg })`), then back home.
export default function FriendEggScreen() {
  const { interactionId } = useLocalSearchParams<{ interactionId: string }>();
  const insets = useSafeAreaInsets();
  const egg = useFriendEgg(interactionId);
  const people = usePeople();
  const react = useReact();
  const markOpened = useOpenChickEgg();
  const e = egg.data;
  const media = useMediaUrl(e?.media_path ?? null);
  const from = e ? people.data?.people.get(e.sender_id) : undefined;

  const ready = !!e && !!from && (!e.media_path || !!media.data);
  if (!ready || !e || !from) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const dateLabel = new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
  const fromName = from.username;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RevealEgg
        fromName={fromName}
        fromId={from.id}
        groupName="a just-because egg"
        fromLine={`from ${fromName}, delivered by the chick`}
        dateLabel={dateLabel}
        // The egg as the sender decorated it; older eggs (sent before egg_style existed) use their profile egg.
        egg={{ ...(e.egg_style ? eggStyleOf(e) : from.egg), text: e.body }}
        message={{ kind: e.kind === 'voice' ? 'voice' : e.kind === 'photo' ? 'photo' : 'text', url: media.data ?? null, body: e.body }}
        top={insets.top}
        onReact={async (emoji) => react.mutate({ interactionId: e.id, emoji })}
        onClose={async () => {
          markOpened(e.id);
          afterReply(() => router.back());
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
