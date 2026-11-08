import type { ReactNode } from 'react';
import { Children, Fragment, isValidElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, radii, shadow, spacing, type, weight } from '@/theme';

/**
 * The prototype's settings layout: a small grey heading (`.set-h`) over one white card
 * (`.set-group`) whose rows (`.set-row`) are split by hairlines.
 */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View>
      {title ? <Text style={styles.heading}>{title}</Text> : null}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={styles.hairline} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

interface RowProps {
  title: string;
  /** Small grey line under the title (`.set-row.two small`). */
  description?: string;
  /** Grey text on the right (`.set-row em`). */
  value?: string;
  /** Shows a switch on the right. */
  toggle?: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean };
  /** Makes the row tappable (chevron on the right, unless it's a toggle). */
  onPress?: () => void;
  loading?: boolean;
  danger?: boolean;
}

export function SettingsRow({ title, description, value, toggle, onPress, loading, danger }: RowProps) {
  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {loading ? <ActivityIndicator color={colors.textMuted} /> : null}
      {toggle ? (
        // Fixed box, centered in the row: iOS 26 draws its (bigger) switch from the top of whatever
        // box it's given, which left every switch hugging the top of its row.
        <View style={styles.switchBox}>
          <Switch
            value={toggle.value}
            onValueChange={toggle.onChange}
            disabled={toggle.disabled}
            accessibilityLabel={title}
            trackColor={{ true: colors.primary, false: colors.grey }}
            ios_backgroundColor={colors.grey}
            thumbColor={colors.eggWhite}
          />
        </View>
      ) : onPress && !loading ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, description && styles.two]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.row, description && styles.two, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.label, color: colors.textSecondary, marginTop: 18, marginBottom: spacing.sm, marginHorizontal: 6 },
  group: { ...shadow.card, backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  hairline: { height: 1, backgroundColor: colors.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  two: { paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 3 },
  title: { ...type.body, ...weight('500'), lineHeight: 19, color: colors.text },
  danger: { color: colors.danger },
  description: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  value: { ...type.body, fontSize: 14, color: colors.textMuted, textAlign: 'right', flexShrink: 1 },
  chevron: { ...type.title, color: colors.textMuted },
  switchBox: { height: 31, minWidth: 51, justifyContent: 'center', alignItems: 'flex-end', alignSelf: 'center' },
});
