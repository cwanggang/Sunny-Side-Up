import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import {
  HEALTHKIT_ENABLED,
  requestSignalPermissions,
  setHomeLocation,
  signOut,
  uploadSignalsNow,
  useConsent,
  useDeleteAccount,
  usePause,
  useSession,
  useSignalStatus,
  useUpdateConsent,
  useWhatTheAppSaw,
  type Consent,
  type ConsentUpdate,
  type DailySignal,
} from '@/api';
import { Body, Button, Heading, ListItem, Screen, ToggleRow } from '@/components';
import { spacing } from '@/theme';

const PAUSES = [
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
] as const;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function describeRow(r: DailySignal): string {
  const parts: string[] = [];
  if (r.hours_away_from_home !== null) parts.push(`${r.hours_away_from_home} h away from home`);
  if (r.places_visited !== null) parts.push(`${r.places_visited} places`);
  if (r.sleep_hours !== null) parts.push(`${r.sleep_hours} h sleep`);
  if (r.steps !== null) parts.push(`${r.steps.toLocaleString()} steps`);
  return parts.join(' · ') || 'nothing';
}

// A4.7 settings: signal toggles, permissions, set home, pause, what the app saw, notifications,
// crisis line, sign out, delete account.
export default function SettingsScreen() {
  const { session } = useSession();
  const consent = useConsent();
  const update = useUpdateConsent();
  const status = useSignalStatus();
  const saw = useWhatTheAppSaw();
  const pause = usePause();
  const deleteAccount = useDeleteAccount();

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Show the value being saved right away, then the saved value.
  const value = (key: keyof ConsentUpdate, data: Consent) =>
    update.isPending && update.variables?.[key] !== undefined ? !!update.variables[key] : data[key];
  const toggle = (key: keyof ConsentUpdate) => (next: boolean) =>
    update.mutate(
      { [key]: next },
      {
        // Switching a signal ON also asks iOS for access right away (location, then Health).
        onSuccess: () => {
          if (next && (key === 'location' || key === 'health')) {
            void run('perm', requestSignalPermissions, 'Access updated.');
          }
        },
      },
    );

  async function run(label: string, action: () => Promise<void>, done: string) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
      if (done) setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      void status.refetch();
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This removes your profile, everything you posted, and your signal data, and takes you out of every circle. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  }

  const c = consent.data;
  const s = status.data;
  const pausedUntil = c?.paused_until && new Date(c.paused_until) > new Date() ? c.paused_until : null;

  return (
    <Screen
      title="Settings"
      refreshing={consent.isRefetching || status.isRefetching}
      onRefresh={() => {
        void consent.refetch();
        void status.refetch();
        void saw.refetch();
      }}
    >
      <Body muted>Signed in as {session?.user.email ?? 'unknown'}</Body>
      <ListItem title="Edit profile" onPress={() => router.push('/profile-setup')} />

      {consent.error ? <Body error>Couldn&apos;t load your settings: {consent.error.message}</Body> : null}
      {update.error ? <Body error>Couldn&apos;t save: {update.error.message}</Body> : null}

      {c ? (
        <>
          <Heading>What the app may use</Heading>
          <ToggleRow
            title="Location summary"
            description="Hours away from home and places visited per day. Your actual location stays on your phone."
            value={value('location', c)}
            onValueChange={toggle('location')}
          />
          {HEALTHKIT_ENABLED ? (
            <ToggleRow
              title="Sleep and steps"
              description="Last night's hours of sleep and yesterday's steps, from Apple Health."
              value={value('health', c)}
              onValueChange={toggle('health')}
            />
          ) : null}
          <ToggleRow
            title="Friendly nudges about me"
            description="If you've been quieter than usual, a friend may get a nudge to reach out."
            value={value('auto_nudges', c)}
            onValueChange={toggle('auto_nudges')}
          />
          <ListItem title="How your data is used" onPress={() => router.push('/consent')} />

          <Heading>On this phone</Heading>
          {s ? (
            <>
              <Body muted>
                Location:{' '}
                {s.locationBackground === 'granted'
                  ? 'always allowed'
                  : s.locationForeground === 'granted'
                    ? 'only while using the app (needs "Always" for daily numbers)'
                    : s.locationForeground === 'denied'
                      ? 'blocked in iPhone Settings'
                      : 'not asked yet'}
              </Body>
              <Body muted>Home: {s.homeSet ? 'set' : 'not set'}</Body>
              <Body muted>Last upload: {s.lastUploadAt ? fmtDateTime(s.lastUploadAt) : 'none yet'}</Body>
            </>
          ) : null}
          <Button
            variant="secondary"
            label="Allow access on this phone"
            onPress={() => void run('perm', requestSignalPermissions, 'Access updated.')}
            loading={busy === 'perm'}
            disabled={!c.location && !(c.health && HEALTHKIT_ENABLED)}
          />
          {s && (s.locationForeground === 'denied' || (s.locationForeground === 'granted' && s.locationBackground !== 'granted')) ? (
            <>
              <Body muted>
                iOS only asks once. To change it: Settings app → Sunny Side Up → Location → Always. For sleep and
                steps: Health app → your profile → Apps → Sunny Side Up.
              </Body>
              <Button variant="secondary" label="Open iPhone Settings" onPress={() => void Linking.openSettings()} />
            </>
          ) : null}
          <Button
            variant="secondary"
            label="I'm home: set home here"
            onPress={() => void run('home', setHomeLocation, 'Home saved on this phone.')}
            loading={busy === 'home'}
            disabled={!c.location}
          />
          <Button
            variant="secondary"
            label="Send yesterday's numbers now"
            onPress={() =>
              void run('upload', async () => setMessage(await uploadSignalsNow()), '').then(() => saw.refetch())
            }
            loading={busy === 'upload'}
          />
          {message ? <Body muted>{message}</Body> : null}

          <Heading>Notifications</Heading>
          <ToggleRow title="Daily photo reminder" value={value('notify_daily_photo', c)} onValueChange={toggle('notify_daily_photo')} />
          <ToggleRow title="Sunday share reminder" value={value('notify_sunday', c)} onValueChange={toggle('notify_sunday')} />
          <ToggleRow title="When friends post" value={value('notify_friend_posts', c)} onValueChange={toggle('notify_friend_posts')} />

          <Heading>Pause</Heading>
          <Body muted>
            {pausedUntil
              ? `Paused until ${fmtDateTime(pausedUntil)}. No nudges about you and no reminders to you.`
              : 'Take a break: no nudges about you and no reminders to you.'}
          </Body>
          {pausedUntil ? (
            <Button variant="secondary" label="Resume now" onPress={() => pause.mutate({ until: null })} loading={pause.isPending} />
          ) : (
            <View style={styles.row}>
              {PAUSES.map((p) => (
                <View key={p.label} style={styles.third}>
                  <Button
                    variant="secondary"
                    label={p.label}
                    onPress={() => pause.mutate({ until: new Date(Date.now() + p.hours * 3_600_000).toISOString() })}
                    disabled={pause.isPending}
                  />
                </View>
              ))}
            </View>
          )}
          {pause.error ? <Body error>{pause.error.message}</Body> : null}
        </>
      ) : null}

      <Heading>What the app saw</Heading>
      <Body muted>Exactly what was uploaded for you, one row per day.</Body>
      {saw.error ? <Body error>{saw.error.message}</Body> : null}
      {saw.data?.length === 0 ? <Body muted>Nothing uploaded yet.</Body> : null}
      {saw.data?.map((r) => (
        <ListItem key={r.day} title={r.day} subtitle={describeRow(r)} />
      ))}

      <Heading>If you&apos;re struggling</Heading>
      <Body muted>Call or text 988, the Suicide &amp; Crisis Lifeline.</Body>
      <View style={styles.row}>
        <View style={styles.half}>
          <Button variant="secondary" label="Call 988" onPress={() => Linking.openURL('tel:988')} />
        </View>
        <View style={styles.half}>
          <Button variant="secondary" label="Text 988" onPress={() => Linking.openURL('sms:988')} />
        </View>
      </View>

      <Heading>Account</Heading>
      <ListItem title="Demo controls (dev)" onPress={() => router.push('/demo')} />
      <Button
        variant="secondary"
        label="Sign out"
        onPress={() => void run('signout', signOut, '')}
        loading={busy === 'signout'}
      />
      {deleteAccount.error ? <Body error>Couldn&apos;t delete: {deleteAccount.error.message}</Body> : null}
      <Button variant="danger" label="Delete account" onPress={confirmDelete} loading={deleteAccount.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  third: { flex: 1 },
});
