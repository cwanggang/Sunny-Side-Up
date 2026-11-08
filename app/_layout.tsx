import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ApiProvider, useInviteLinkHandler, useNotifications, useSession } from '@/api';

// Keep the native splash up until the stored session has been restored (A1.1).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <ApiProvider>
      <RootStack />
    </ApiProvider>
  );
}

// A1.1 auth gate: signed out → only (auth)/sign-in; signed in → everything else.
// Every route must be listed under one of the guards, or it would be reachable signed out.
// Exception: join/[code] is open to both, so an invite link opened while signed out survives sign-in.
function RootStack() {
  const { session, loading } = useSession();
  const signedIn = !!session;

  // A1.4: own `notifications` rows → local notifications (no-op while signed out).
  useNotifications();
  // A1.4: resumes an invite link that was opened while signed out.
  useInviteLinkHandler();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/consent" />
        <Stack.Screen name="(auth)/profile-setup" />
        <Stack.Screen name="circle/[id]/index" />
        <Stack.Screen name="circle/[id]/feed" />
        <Stack.Screen name="circle/[id]/compose" />
        <Stack.Screen name="circle/[id]/sunday" />
        <Stack.Screen name="circle/[id]/spotlight" />
        <Stack.Screen name="circle/[id]/birthdays" />
        <Stack.Screen name="circle/[id]/hangouts" />
        <Stack.Screen name="(dev)/demo" />
      </Stack.Protected>

      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
