import { Stack } from 'expo-router';

import { ApiProvider } from '@/api';

// A0.3 root layout. A1.1 adds the auth gate (signed out → (auth)/sign-in).
export default function RootLayout() {
  return (
    <ApiProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ApiProvider>
  );
}
