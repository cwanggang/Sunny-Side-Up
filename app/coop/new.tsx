import { router } from 'expo-router';
import { useRef } from 'react';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCoopCode, inviteMessage, localImageDataUrl, useCreateCoop, usePhotoPicker } from '@/api';
import { afterReply } from '@/dom/defer';
import NewCoop from '@/dom/NewCoop';
import { colors } from '@/theme';

// "new coop": the prototype's form and hatch animation (src/dom/NewCoop.tsx).
export default function NewCoopScreen() {
  const insets = useSafeAreaInsets();
  const create = useCreateCoop();
  const pick = usePhotoPicker();
  const cover = useRef<string | null>(null);
  const made = useRef<{ id: string; name: string; invite_code: string } | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NewCoop
        top={insets.top}
        onBack={async () => afterReply(() => router.back())}
        onPickPhoto={async () => {
          const uri = await pick();
          if (!uri) return null;
          cover.current = uri;
          return localImageDataUrl(uri);
        }}
        onHatch={async (name, description) => {
          const c = await create.mutateAsync({ name, description, coverUri: cover.current });
          made.current = c;
          return { code: formatCoopCode(c.invite_code), invite: inviteMessage(c) };
        }}
        onShare={async () => {
          if (made.current) await Share.share({ message: inviteMessage(made.current) });
        }}
        onDone={async () => {
          const c = made.current;
          afterReply(() => (c ? router.replace(`/circle/${c.id}/coop?welcome=1`) : router.back()));
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
