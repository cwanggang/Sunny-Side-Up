import { router } from 'expo-router';

import { ListItem, Screen } from '@/components';

// A0.3 placeholder. Built in A1.5 (my circles, create, join by code).
export default function CirclesScreen() {
  return (
    <Screen title="Circles" note="Baseline screen: built in A1.5.">
      <ListItem title="Sample circle" subtitle="Opens circle detail" onPress={() => router.push('/circle/demo-circle')} />
    </Screen>
  );
}
