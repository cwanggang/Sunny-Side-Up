import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Design v0.5 (A5, handed to Developer B): no tab bar. Home ("my coops" / "sunny sunday!") has a
// corner egg menu that opens nudges, settings, the calendar and the demo controls; they push on
// top of home with a back button. The group keeps its name so /circles, /nudges and /settings
// still resolve everywhere (notification routing, invite links, onboarding).
export const unstable_settings = { initialRouteName: 'circles' };

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="circles" options={{ headerShown: false, title: 'my coops' }} />
      <Stack.Screen name="nudges" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="coops" options={{ headerShown: false }} />
    </Stack>
  );
}
