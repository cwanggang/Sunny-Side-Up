import { Redirect } from 'expo-router';

import { useSession } from '@/api';

// Entry route. Signed out, the auth gate in _layout.tsx sends you to sign-in instead.
// A brand-new account goes through consent → profile setup first (A1.5).
export default function Index() {
  const { isNewAccount } = useSession();
  return <Redirect href={isNewAccount ? '/consent?onboarding=1' : '/circles'} />;
}
