import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  demoKeyConfigured,
  describeDemoAction,
  USE_MOCKS,
  useDemoAction,
  type DemoAction,
} from '@/api';
import { Button, Screen } from '@/components';
import { colors, radii, spacing, type, weight } from '@/theme';

// A4.7 (dev) demo controls, built by Developer B (plan §5 load-balancing handoff of app/(dev)/).
// Demo order: 1 Reset demo -> 2 Run drift + nudge. Keep the app OPEN on the nudge recipient's
// phone (Jocelyn): notifications are local and only show while the app is running (plan §3.0).

interface LogEntry {
  at: string;
  action: string;
  ok: boolean;
  text: string;
}

// The demo is in Durham (Eastern time, UTC-5 in November). Forced times are 9:30 / 10:30 ET.
const ET_OFFSET_HOURS = 5;
function easternTime(daysFromToday: number, hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  d.setUTCHours(hour + ET_OFFSET_HOURS, minute, 0, 0);
  return d.toISOString();
}
function daysUntilSunday(): number {
  const dow = new Date().getDay(); // 0 = Sunday
  return dow === 0 ? 0 : 7 - dow;
}

const SCHEDULER_PRESETS: { title: string; hint: string; action: DemoAction }[] = [
  {
    title: 'Sunday 10:30 am',
    hint: 'Sunday share prompt + spotlight',
    action: { kind: 'scheduler', now: easternTime(daysUntilSunday(), 10, 30), label: 'Sunday 10:30 am' },
  },
  {
    title: 'Tomorrow 9:30 am',
    hint: 'Spotlight + any birthdays',
    action: { kind: 'scheduler', now: easternTime(1, 9, 30), label: 'tomorrow 9:30 am' },
  },
  {
    title: 'In 2 days, 9:30 am',
    hint: "Moment shout-out (Caden's job interview)",
    action: { kind: 'scheduler', now: easternTime(2, 9, 30), label: 'in 2 days 9:30 am' },
  },
];

export default function DemoScreen() {
  const demo = useDemoAction();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const run = (action: DemoAction) => {
    const name = describeDemoAction(action);
    setRunning(name);
    demo.mutate(action, {
      onSuccess: (res) => addLog(name, res.ok, res.summary),
      onError: (err) => addLog(name, false, err.message),
      onSettled: () => setRunning(null),
    });
  };
  const addLog = (action: string, ok: boolean, text: string) =>
    setLog((prev) => [{ at: new Date().toLocaleTimeString(), action, ok, text }, ...prev].slice(0, 20));

  const busy = running !== null;
  const blocked = !USE_MOCKS && !demoKeyConfigured;

  return (
    <Screen title="Demo controls">
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.body}>Data: {USE_MOCKS ? 'mocks (nothing is sent)' : 'Supabase'}</Text>
        <Text style={[styles.body, blocked && styles.error]}>
          Demo key: {USE_MOCKS ? 'not needed in mock mode' : demoKeyConfigured ? 'set' : 'missing (add EXPO_PUBLIC_DEMO_KEY to .env.local)'}
        </Text>
        <Text style={styles.hint}>Keep the app open on the nudge recipient&apos;s phone.</Text>
      </View>

      <Text style={styles.section}>Main demo</Text>
      <Button
        label="1. Reset demo"
        variant="secondary"
        onPress={() => run({ kind: 'reseed' })}
        loading={running === 'Reset demo'}
        disabled={busy || blocked}
      />
      <Text style={styles.hint}>21 days of history for the demo circle; one friend goes quiet.</Text>
      <Button
        label="2. Run drift + nudge"
        onPress={() => run({ kind: 'drift-and-nudge' })}
        loading={running === 'Run drift + nudge'}
        disabled={busy || blocked}
      />
      <Text style={styles.hint}>A friend gets a natural &ldquo;reach out&rdquo; notification. Reset before running it again.</Text>

      <Text style={styles.section}>Rhythm (force the scheduler)</Text>
      {SCHEDULER_PRESETS.map((p) => (
        <View key={p.title} style={styles.preset}>
          <Button
            label={p.title}
            variant="secondary"
            onPress={() => run(p.action)}
            loading={running === describeDemoAction(p.action)}
            disabled={busy || blocked}
          />
          <Text style={styles.hint}>{p.hint}</Text>
        </View>
      ))}

      <Text style={styles.section}>Other</Text>
      <Button
        label="Score drift only"
        variant="secondary"
        onPress={() => run({ kind: 'score-drift' })}
        loading={running === 'Score drift only'}
        disabled={busy || blocked}
      />

      {log.length > 0 ? <Text style={styles.section}>Results</Text> : null}
      {log.map((entry, i) => (
        <View key={`${entry.at}-${i}`} style={styles.logRow}>
          <Text style={styles.hint}>
            {entry.at} · {entry.action}
          </Text>
          <Text style={[styles.body, !entry.ok && styles.error]}>{entry.text}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: { ...type.caption, color: colors.textMuted, ...weight('600') },
  section: { ...type.body, ...weight('600'), color: colors.text, marginTop: spacing.md },
  body: { ...type.body, color: colors.text },
  hint: { ...type.caption, color: colors.textMuted },
  error: { color: colors.danger },
  preset: { gap: spacing.xs },
  logRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
