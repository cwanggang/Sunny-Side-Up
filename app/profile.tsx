import { router } from 'expo-router';
import { useMemo } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eggOf, factsOf, localImageDataUrl, useFactIdeas, useMediaUrl, useMyFullProfile, usePhotoPicker, useSaveProfile } from '@/api';
import { afterReply } from '@/dom/defer';
import ProfilePage from '@/dom/ProfilePage';
import { colors } from '@/theme';

// "your profile": the prototype's editing page (src/dom/ProfilePage.tsx).
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const q = useMyFullProfile();
  const p = q.data;
  const photo = useMediaUrl(p?.avatar_path ?? null);
  const save = useSaveProfile();
  const pick = usePhotoPicker();
  const ideas = useFactIdeas();

  const profile = useMemo(
    () =>
      p
        ? {
            id: p.id,
            username: p.username,
            name: p.display_name,
            birthday: p.birthday ?? '',
            photoUrl: photo.data ?? null,
            egg: (() => {
              const e = eggOf(p.egg_style);
              return { swatch: e.swatch, pattern: e.pattern === 'none' ? 'plain' : e.pattern };
            })(),
            facts: factsOf(p.facts),
          }
        : null,
    [p, photo.data],
  );

  // Wait for the photo's signed URL too, so the page opens with it rather than swapping it in.
  if (!profile || (p?.avatar_path && !photo.data && !photo.error)) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfilePage
        top={insets.top}
        profile={profile}
        onBack={async () => afterReply(() => router.back())}
        onSave={async (patch) => {
          try {
            await save.mutateAsync({
              username: patch.username,
              display_name: patch.name,
              birthday: patch.birthday,
              egg: patch.egg,
              facts: patch.facts,
            });
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "that didn't save";
          }
        }}
        onPhoto={async () => {
          const uri = await pick({ square: true });
          if (!uri) return null;
          await save.mutateAsync({ photoUri: uri });
          return localImageDataUrl(uri);
        }}
        onIdeas={async (have) => (await ideas.mutateAsync({ have })).ideas}
        onPreview={async () => router.push(`/member/${profile.id}`)}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </KeyboardAvoidingView>
  );
}
