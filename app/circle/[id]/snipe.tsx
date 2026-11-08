import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localImageDataUrl, useCoop, useCoopPeople, useEggWar, useMediaUrlMap, usePostSnipe, useSession } from '@/api';
import { afterReply } from '@/dom/defer';
import SnipeTag from '@/dom/SnipeTag';
import { colors } from '@/theme';

// "who did you get?" (src/dom/SnipeTag.tsx): the photo you just took, who you egged (only people who opted
// in), an optional caption, send.
export default function SnipeScreen() {
  const { id, warId, uri } = useLocalSearchParams<{ id: string; warId: string; uri: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const coop = useCoop(id);
  const status = useEggWar(id);
  const people = useCoopPeople(id);
  const post = usePostSnipe(id);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (uri) void localImageDataUrl(uri).then(setPhoto);
  }, [uri]);

  const urls = useMediaUrlMap((people.data ?? []).map((p) => p.avatarPath));
  const ins = status.data?.war?.people;
  const targets = useMemo(
    () =>
      (ins ?? [])
        .filter((p) => p.choice === 'in' && p.user_id !== me)
        .map((p) => {
          const x = people.data?.find((y) => y.id === p.user_id);
          return { id: p.user_id, username: x?.username || x?.name.toLowerCase() || 'friend', photoUrl: x?.avatarPath ? (urls[x.avatarPath] ?? null) : null };
        }),
    [ins, me, people.data, urls],
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <SnipeTag
        top={insets.top}
        coopName={coop?.name ?? ''}
        photoUrl={photo}
        targets={targets}
        onRetake={async () => afterReply(() => router.back())}
        onSend={async (targetId, caption) => {
          await post.mutateAsync({ warId, targetId, uri, caption });
          afterReply(() => router.dismissTo(`/circle/${id}/war`));
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </KeyboardAvoidingView>
  );
}
