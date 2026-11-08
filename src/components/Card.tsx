import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REACTION_EMOJI, useConsent, useShareReactions, useToggleShareReaction, useUpdateConsent } from '@/api';
import { colors, radii, shadow, spacing, type } from '@/theme';

import { ToggleRow } from './ToggleRow';

/** White rounded card (design v0.3). */
export function Card({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'yolk' }) {
  return <View style={[styles.card, tone === 'yolk' && styles.yolk]}>{children}</View>;
}

/** ❤️ 😂 🥚 🙌 under a post. Counts from everyone; tapping toggles mine. Hidden for my own post. */
export function ReactionBar({ shareId, myUserId, isMine }: { shareId: string; myUserId: string | null; isMine?: boolean }) {
  const reactions = useShareReactions([shareId]);
  const toggle = useToggleShareReaction();
  const list = (reactions.data ?? []).filter((r) => r.share_id === shareId);
  return (
    <View style={styles.reactions}>
      {REACTION_EMOJI.map((emoji) => {
        const count = list.filter((r) => r.emoji === emoji).length;
        const mine = list.some((r) => r.emoji === emoji && r.user_id === myUserId);
        if (isMine && count === 0) return null;
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`react ${emoji}`}
            disabled={isMine || toggle.isPending}
            onPress={() => toggle.mutate({ shareId, emoji, on: !mine })}
            style={[styles.reaction, mine && styles.reactionOn]}
          >
            <Text style={styles.reactionText}>
              {emoji}
              {count ? ` ${count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Settings → notifications (design v0.3). Drop into the settings screen:
 * daily photo reminder, sunny sunday reminder, when friends post.
 */
export function NotificationSettings() {
  const consent = useConsent();
  const update = useUpdateConsent();
  const c = consent.data;
  if (!c) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>notifications</Text>
      <ToggleRow
        title="daily photo reminder"
        description="when it's your day to post"
        value={c.notify_daily_photo}
        onValueChange={(v) => update.mutate({ notify_daily_photo: v })}
      />
      <ToggleRow
        title="sunny sunday reminder"
        description="crack your egg, and a nudge if you haven't sent yours"
        value={c.notify_sunday}
        onValueChange={(v) => update.mutate({ notify_sunday: v })}
      />
      <ToggleRow
        title="when friends post"
        description="today's photo and eggs for everyone"
        value={c.notify_friend_posts}
        onValueChange={(v) => update.mutate({ notify_friend_posts: v })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, ...shadow.card },
  yolk: { backgroundColor: colors.primarySoft },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reaction: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt },
  reactionOn: { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primaryDeep },
  reactionText: { ...type.body },
  group: { gap: spacing.sm },
  groupLabel: { ...type.label, color: colors.textSecondary, marginTop: spacing.md },
});
