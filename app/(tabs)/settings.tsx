import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import {
  eggOf,
  HEALTHKIT_ENABLED,
  requestSignalPermissions,
  setHomeLocation,
  signOut,
  uploadSignalsNow,
  useChickPrefs,
  useConsent,
  useDeleteAccount,
  useMyFullProfile,
  usePause,
  useSession,
  useSetChickPrefs,
  useSignalStatus,
  useUpdateConsent,
  useWhatTheAppSaw,
  type Consent,
  type ConsentUpdate,
  type DailySignal,
} from '@/api';
import { Body, Screen, SettingsGroup, SettingsRow } from '@/components';
import { Avatar } from '@/components/Coop';
import { colors, spacing, type, weight } from '@/theme';

const PAUSES = [
  { label: 'pause for a day', hours: 24 },
  { label: 'pause for 3 days', hours: 72 },
  { label: 'pause for a week', hours: 168 },
] as const;

const fmtDateTime = (iso: string) =>
  new Date(iso)
    .toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toLowerCase();

function describeRow(r: DailySignal): string {
  const parts: string[] = [];
  if (r.hours_away_from_home !== null) parts.push(`${r.hours_away_from_home} h away from home`);
  if (r.places_visited !== null) parts.push(`${r.places_visited} places`);
  if (r.sleep_hours !== null) parts.push(`${r.sleep_hours} h sleep`);
  if (r.steps !== null) parts.push(`${r.steps.toLocaleString()} steps`);
  return parts.join(' · ') || 'nothing';
}

// A4.7 settings in the v0.5 prototype's layout (grouped rows, lowercase). The privacy rows keep the
// prototype's names but describe what this build really does (plan §9.1, §9.4, §9.9): friends never
// see location, sleep or steps; only two location numbers and sleep/steps go to the server.
export default function SettingsScreen() {
  const { session } = useSession();
  const me = useMyFullProfile();
  const consent = useConsent();
  const update = useUpdateConsent();
  const status = useSignalStatus();
  const saw = useWhatTheAppSaw();
  const pause = usePause();
  const deleteAccount = useDeleteAccount();
  const chick = useChickPrefs();
  const setChick = useSetChickPrefs();

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Show the value being saved right away, then the saved value.
  const value = (key: keyof ConsentUpdate, data: Consent) =>
    update.isPending && update.variables?.[key] !== undefined ? !!update.variables[key] : data[key];
  const toggle = (key: keyof ConsentUpdate, data: Consent) => ({
    value: value(key, data),
    onChange: (next: boolean) =>
      update.mutate(
        { [key]: next },
        {
          // Switching a signal ON also asks iOS for access right away (location, then Health).
          onSuccess: () => {
            if (next && (key === 'location' || key === 'health')) {
              void run('perm', requestSignalPermissions, 'access updated.');
            }
          },
        },
      ),
  });

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
      'delete your account?',
      'this removes your profile, everything you posted, and your signal data, and takes you out of every coop. it cannot be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        { text: 'delete', style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  }

  const c = consent.data;
  const s = status.data;
  const p = me.data;
  const pausedUntil = c?.paused_until && new Date(c.paused_until) > new Date() ? c.paused_until : null;
  const locationState = !s
    ? 'checking'
    : s.locationBackground === 'granted'
      ? 'always'
      : s.locationForeground === 'granted'
        ? 'only while open'
        : s.locationForeground === 'denied'
          ? 'blocked'
          : 'not asked yet';
  const needsIosSettings =
    !!s && (s.locationForeground === 'denied' || (s.locationForeground === 'granted' && s.locationBackground !== 'granted'));

  return (
    <Screen
      title="settings"
      refreshing={consent.isRefetching || status.isRefetching}
      onRefresh={() => {
        void consent.refetch();
        void status.refetch();
        void saw.refetch();
        void me.refetch();
      }}
    >
      {/* `.set-me`: avatar, name, @username */}
      <View style={styles.me}>
        {p ? <Avatar person={{ avatarPath: p.avatar_path, egg: eggOf(p.egg_style), username: p.username }} size={74} /> : null}
        <Text style={styles.meName}>{(p?.display_name ?? '').toLowerCase() || 'you'}</Text>
        <Text style={styles.meHandle}>{p?.username ? `@${p.username}` : (session?.user.email ?? '')}</Text>
      </View>

      {consent.error ? <Body error>couldn&apos;t load your settings: {consent.error.message}</Body> : null}
      {update.error ? <Body error>couldn&apos;t save: {update.error.message}</Body> : null}

      {c ? (
        <>
          <SettingsGroup title="notifications">
            <SettingsRow title="daily photo reminder" toggle={toggle('notify_daily_photo', c)} />
            <SettingsRow title="sunny sunday reminder" toggle={toggle('notify_sunday', c)} />
            <SettingsRow title="when friends post" toggle={toggle('notify_friend_posts', c)} />
            <SettingsRow
              title="chick nudges"
              description="a chick drops by when someone could use an egg from you"
              toggle={{ value: chick.data?.on ?? true, onChange: (on) => setChick.mutate({ on }) }}
            />
          </SettingsGroup>

          <SettingsGroup title="privacy">
            <SettingsRow title="who sees my photos" value="only my coops" />
            <SettingsRow
              title="location summary"
              description="your phone counts hours away from home and places visited. only those two numbers leave your phone. friends never see your location."
              toggle={toggle('location', c)}
            />
            {HEALTHKIT_ENABLED ? (
              <SettingsRow
                title="sleep and steps"
                description="last night's sleep and yesterday's steps help the app notice a quiet stretch. friends never see them."
                toggle={toggle('health', c)}
              />
            ) : null}
            <SettingsRow
              title="friendly nudges about me"
              description="let the app nudge a friend to check in when you've been quiet. they're never told why."
              toggle={toggle('auto_nudges', c)}
            />
            <SettingsRow title="photos last" value="until the next rotation" />
            <SettingsRow title="how your data is used" onPress={() => router.push('/consent')} />
          </SettingsGroup>

          <SettingsGroup title="on this phone">
            <SettingsRow title="location access" value={locationState} />
            <SettingsRow title="home" value={s?.homeSet ? 'set' : 'not set'} />
            <SettingsRow title="last upload" value={s?.lastUploadAt ? fmtDateTime(s.lastUploadAt) : 'none yet'} />
            {c.location || (c.health && HEALTHKIT_ENABLED) ? (
              <SettingsRow
                title="allow access on this phone"
                onPress={() => void run('perm', requestSignalPermissions, 'access updated.')}
                loading={busy === 'perm'}
              />
            ) : null}
            {needsIosSettings ? (
              <SettingsRow
                title="open iphone settings"
                description='ios only asks once. choose location → "always". for sleep and steps: health app → profile → apps.'
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
            {c.location ? (
              <SettingsRow
                title="i'm home: set home here"
                onPress={() => void run('home', setHomeLocation, 'home saved on this phone.')}
                loading={busy === 'home'}
              />
            ) : null}
            <SettingsRow
              title="send yesterday's numbers now"
              onPress={() => void run('upload', async () => setMessage(await uploadSignalsNow()), '').then(() => saw.refetch())}
              loading={busy === 'upload'}
            />
          </SettingsGroup>
          {message ? <Body muted>{message.toLowerCase()}</Body> : null}

          <SettingsGroup title="pause">
            {pausedUntil ? (
              <SettingsRow title="paused until" value={fmtDateTime(pausedUntil)} />
            ) : (
              <SettingsRow title="take a break" description="no nudges about you and no reminders to you." />
            )}
            {pausedUntil ? (
              <SettingsRow title="resume now" onPress={() => pause.mutate({ until: null })} loading={pause.isPending} />
            ) : (
              PAUSES.map((x) => (
                <SettingsRow
                  key={x.label}
                  title={x.label}
                  onPress={() => pause.mutate({ until: new Date(Date.now() + x.hours * 3_600_000).toISOString() })}
                />
              ))
            )}
          </SettingsGroup>
          {pause.error ? <Body error>{pause.error.message}</Body> : null}
        </>
      ) : null}

      <SettingsGroup title="what the app saw">
        <SettingsRow title="exactly what was uploaded for you" description="one row per day, last two weeks." />
        {saw.data?.length === 0 ? <SettingsRow title="nothing uploaded yet" /> : null}
        {(saw.data ?? []).map((r) => (
          <SettingsRow key={r.day} title={r.day} description={describeRow(r)} />
        ))}
      </SettingsGroup>
      {saw.error ? <Body error>{saw.error.message}</Body> : null}

      <SettingsGroup title="if you're struggling">
        <SettingsRow title="call 988" description="suicide & crisis lifeline" onPress={() => void Linking.openURL('tel:988')} />
        <SettingsRow title="text 988" onPress={() => void Linking.openURL('sms:988')} />
      </SettingsGroup>

      <SettingsGroup title="account">
        <SettingsRow title="edit profile" onPress={() => router.push('/profile')} />
        <SettingsRow title="demo controls" onPress={() => router.push('/demo')} />
        <SettingsRow title="sign out" onPress={() => void run('signout', signOut, '')} loading={busy === 'signout'} />
        <SettingsRow title="delete account" danger onPress={confirmDelete} loading={deleteAccount.isPending} />
      </SettingsGroup>
      {deleteAccount.error ? <Body error>couldn&apos;t delete: {deleteAccount.error.message}</Body> : null}

      <SettingsGroup title="about">
        <SettingsRow title="sunny side up" value="hackathon build" />
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: spacing.lg },
  meName: { ...type.title, fontSize: 22, ...weight('600'), color: colors.text, marginTop: 6 },
  meHandle: { ...type.caption, fontSize: 12.5, color: colors.textSecondary },
});
