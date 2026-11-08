import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { HEALTHKIT_ENABLED, requestSignalPermissions, useConsent, useUpdateConsent, type Consent } from '@/api';
import { Body, Button, Screen, SettingsGroup, SettingsRow } from '@/components';

// A1.5 consent. Copy must tell the truth about this build (plan §9.9): daily summary numbers
// and in-app activity counts are uploaded and scored on the server.
export default function ConsentScreen() {
  const consent = useConsent();
  if (consent.data) return <ConsentForm initial={consent.data} />;
  return (
    <Screen title="your privacy">
      {consent.error ? <Body error>couldn&apos;t load your settings: {consent.error.message}</Body> : <Body muted>loading…</Body>}
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
    <Screen title="your privacy">
      <Body>
        sunny side up helps your coops stay close. it can also notice when you&apos;ve been quieter than usual and
        nudge a friend to say hi. your friend sees an ordinary friendly nudge and is never told why.
      </Body>

      <SettingsGroup title="what you choose">
        <SettingsRow
          title="location summary"
          description="each day your phone works out two numbers: hours away from home and how many places you visited. only those two numbers are uploaded. your actual location never leaves your phone, and friends never see it."
          toggle={{ value: location, onChange: setLocation }}
        />
        {HEALTHKIT_ENABLED ? (
          <SettingsRow
            title="sleep and steps"
            description="last night's hours of sleep and yesterday's step count are uploaded. nothing else is read from apple health, and friends never see them."
            toggle={{ value: health, onChange: setHealth }}
          />
        ) : null}
        <SettingsRow
          title="friendly nudges about me"
          description="if you've been quieter than usual, the app may nudge a friend in your coop to reach out. you can pause this any time in settings."
          toggle={{ value: autoNudges, onChange: setAutoNudges }}
        />
      </SettingsGroup>

      <SettingsGroup title="always on">
        <SettingsRow
          title="activity counts"
          description="the app counts your activity: eggs, photos, voice memos and reactions sent and received, sunday shares, and app opens. it counts them only; it never reads what your messages say. these daily counts, plus any summary numbers you allow above, are uploaded to our server, which compares them with your own usual pattern."
        />
      </SettingsGroup>

      <SettingsGroup title="if you're struggling">
        <SettingsRow
          title="friends aren't the emergency plan"
          description="if you're in crisis, call or text 988, the suicide & crisis lifeline."
        />
        <SettingsRow title="call 988" onPress={() => void Linking.openURL('tel:988')} />
        <SettingsRow title="text 988" onPress={() => void Linking.openURL('sms:988')} />
      </SettingsGroup>

      {update.error ? <Body error>couldn&apos;t save: {update.error.message}</Body> : null}
      <Button label={onboarding ? 'continue' : 'save'} onPress={save} loading={update.isPending} />
    </Screen>
  );
}
