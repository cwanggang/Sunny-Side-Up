import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eggStyleOf, isVoicePath, useCircle, useCircleMembers, useMediaUrl, useSundayEgg, useToggleShareReaction } from '@/api';
import { sundayUi } from '@/components';
import { afterReply } from '@/dom/defer';
import RevealEgg from '@/dom/RevealEgg';
import { colors } from '@/theme';

// "you have an egg!": the prototype's full-screen reveal (crack, spill, yolk bar, their message).
// `?again=1` skips straight to the message, like the prototype's "tap to watch again".
export default function RevealScreen() {
  const { id, again } = useLocalSearchParams<{ id: string; again?: string }>();
  const insets = useSafeAreaInsets();
  const egg = useSundayEgg(id);
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const react = useToggleShareReaction();
  const theirs = egg.data?.theirs ?? null;
  const media = useMediaUrl(theirs?.media_path ?? null);

  const fromId = egg.data?.fromId ?? egg.data?.sendTo ?? '';
  const fromName = (members.data?.find((m) => m.userId === fromId)?.displayName ?? 'your person').toLowerCase();
  // Wait for the signed URL so the message is ready when the egg opens.
  const ready = !!theirs && !!circle.data && !!members.data && (!theirs.media_path || !!media.data);
  if (!ready || !theirs) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const kind = theirs.media_path ? (isVoicePath(theirs.media_path) ? 'voice' : 'photo') : 'text';
  const dateLabel = new Date(theirs.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RevealEgg
        fromName={fromName}
        fromId={fromId}
        groupName={(circle.data?.name ?? '').toLowerCase()}
        dateLabel={dateLabel}
        egg={{ ...eggStyleOf(theirs), text: theirs.body }}
        message={{ kind, url: media.data ?? null, body: theirs.body }}
        skipIntro={again === '1' || sundayUi.isOpened(theirs.id)}
        top={insets.top}
        onReact={async (emoji) => react.mutate({ shareId: theirs.id, emoji, on: true })}
        onClose={async () => {
          sundayUi.markOpened(theirs.id);
          afterReply(() => router.back());
        }}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
