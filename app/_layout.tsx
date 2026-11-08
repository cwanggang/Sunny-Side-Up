import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  useFonts,
} from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import {
  ApiProvider,
  useInviteLinkHandler,
  useNotificationRouting,
  useNotifications,
  useReportAppOpen,
  useSession,
  useSignalSync,
} from '@/api';

// Keep the native splash up until the stored session is restored (A1.1) and Lexend is loaded (A5.1).
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
  const { session, loading: sessionLoading } = useSession();
  const signedIn = !!session;
  // A5.1: the prototype's font. If loading fails, screens fall back to the system font.
  const [fontsLoaded, fontError] = useFonts({ Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold });
  const loading = sessionLoading || (!fontsLoaded && !fontError);

  // A1.4: own `notifications` rows → local notifications (no-op while signed out).
  useNotifications();
  // A2.5: tapping a notification opens the matching screen.
  useNotificationRouting();
  // A1.4: resumes an invite link that was opened while signed out.
  useInviteLinkHandler();
  // A3.4: app_open on sign-in and each return to the foreground (throttled to 30 min).
  useReportAppOpen();
  // A4.5: on-phone collection follows consent; yesterday's daily row is uploaded if due.
  useSignalSync();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
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
        {/* Design v0.4 screens (Developer B) */}
        <Stack.Screen name="profile" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="coop/new" />
        <Stack.Screen name="coop/join" />
        <Stack.Screen name="circle/[id]/coop" />
        <Stack.Screen name="circle/[id]/events" />
        <Stack.Screen name="circle/[id]/gallery" />
        <Stack.Screen name="circle/[id]/daily" />
        <Stack.Screen name="event/[eventId]" />
        <Stack.Screen name="event/new" />
        <Stack.Screen name="member/[userId]" />
        {/* Design v0.5 (A5 handoff to Developer B) */}
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        {/* A5 temporary: DOM component check */}
        <Stack.Screen name="dom-check" />
      </Stack.Protected>

      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
