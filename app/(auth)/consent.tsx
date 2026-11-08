import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { HEALTHKIT_ENABLED, requestSignalPermissions, useConsent, useUpdateConsent, type Consent } from '@/api';
import { Body, Button, Heading, Screen, ToggleRow } from '@/components';
import { spacing } from '@/theme';

// A1.5 consent. Copy must tell the truth about this build (plan §9.9): daily summary numbers
// and in-app activity counts are uploaded and scored on the server.
export default function ConsentScreen() {
  const consent = useConsent();
  if (consent.data) return <ConsentForm initial={consent.data} />;
  return (
    <Screen title="Your privacy">
      {consent.error ? <Body error>Couldn&apos;t load your settings: {consent.error.message}</Body> : <Body muted>Loading…</Body>}
    </Screen>
  );
}

function ConsentForm({ initial }: { initial: Consent }) {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const update = useUpdateConsent();

  const [location, setLocation] = useState(initial.location);
  const [health, setHealth] = useState(initial.health);
  const [autoNudges, setAutoNudges] = useState(initial.auto_nudges);

  function save() {
    update.mutate(
      { location, health: HEALTHKIT_ENABLED ? health : false, auto_nudges: autoNudges },
      {
        onSuccess: async (saved) => {
          // Ask iOS for exactly what was just allowed (location, then Health). A "Don't Allow" is fine.
          if (saved.location || (saved.health && HEALTHKIT_ENABLED)) {
            await requestSignalPermissions().catch((e) => console.warn('permission request failed', e));
          }
          if (onboarding) router.replace('/profile-setup?onboarding=1');
          else router.back();
        },
      },
    );
  }

  return (
    <Screen title="Your privacy">
      <Body>
        Sunny Side Up helps your circle stay close. It can also notice when you&apos;ve been quieter than usual and
        nudge a friend to say hi. Your friend sees an ordinary friendly nudge and is never told why.
      </Body>

      <Heading>What you choose</Heading>
      <ToggleRow
        title="Location summary"
        description="Each day your phone works out two numbers: hours away from home and how many places you visited. Only those two numbers are uploaded. Your actual location never leaves your phone."
        value={location}
        onValueChange={setLocation}
      />
      {HEALTHKIT_ENABLED ? (
        <ToggleRow
          title="Sleep and steps"
          description="Last night's hours of sleep and yesterday's step count are uploaded. Nothing else is read from Apple Health."
          value={health}
          onValueChange={setHealth}
        />
      ) : null}
      <ToggleRow
        title="Friendly nudges about me"
        description="If you've been quieter than usual, the app may nudge a friend in your circle to reach out. You can pause this any time in Settings."
        value={autoNudges}
        onValueChange={setAutoNudges}
      />

      <Heading>Always on</Heading>
      <Body muted>
        The app counts your activity: eggs, photos, voice memos and reactions sent and received, Sunday shares, and
        app opens. It counts them only; it never reads what your messages say. These daily counts, plus any summary
        numbers you allow above, are uploaded to our server, which compares them with your own usual pattern.
      </Body>

      <Heading>If you&apos;re struggling</Heading>
      <Body muted>
        Friends are here to stay close, not to be the emergency plan. If you&apos;re in crisis, call or text 988, the
        Suicide &amp; Crisis Lifeline.
      </Body>
      <View style={styles.row}>
        <View style={styles.half}>
          <Button variant="secondary" label="Call 988" onPress={() => Linking.openURL('tel:988')} />
        </View>
        <View style={styles.half}>
          <Button variant="secondary" label="Text 988" onPress={() => Linking.openURL('sms:988')} />
        </View>
      </View>

      {update.error ? <Body error>Couldn&apos;t save: {update.error.message}</Body> : null}
      <Button
        label={onboarding ? 'Continue' : 'Save'}
        onPress={save}
        loading={update.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
