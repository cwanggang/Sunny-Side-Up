import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { signOut, useSession } from '@/api';
import { Button, ListItem, Screen } from '@/components';

// Placeholder. Built in A4.7. Sign out added in A1.1; the links below reach screens
// that A1.5 will put into the sign-up flow.
export default function SettingsScreen() {
  const { session } = useSession();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Could not sign out', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Screen title="Settings" note={`Signed in as ${session?.user.email ?? 'unknown'}. Baseline screen: built in A4.7.`}>
      <ListItem title="Consent" onPress={() => router.push('/consent')} />
      <ListItem title="Profile setup" onPress={() => router.push('/profile-setup')} />
      <ListItem title="Demo controls (dev)" onPress={() => router.push('/demo')} />
      <Button variant="danger" label="Sign out" onPress={onSignOut} loading={busy} />
    </Screen>
  );
}
