import { router, type Href } from 'expo-router';

import { USE_MOCKS } from '@/api';
import { ListItem, Screen } from '@/components';

// A0.3 temporary screen map for tapping through every route (merge point M0).
// A1.1 replaces this with a redirect: signed in → (tabs)/circles, else (auth)/sign-in.
const SAMPLE_CIRCLE = 'demo-circle';

const routes: { title: string; href: Href }[] = [
  { title: 'Sign in', href: '/sign-in' },
  { title: 'Consent', href: '/consent' },
  { title: 'Profile setup', href: '/profile-setup' },
  { title: 'Circles (tabs)', href: '/circles' },
  { title: 'Nudges (tabs)', href: '/nudges' },
  { title: 'Settings (tabs)', href: '/settings' },
  { title: 'Circle detail', href: `/circle/${SAMPLE_CIRCLE}` },
  { title: 'Feed', href: `/circle/${SAMPLE_CIRCLE}/feed` },
  { title: 'Compose', href: `/circle/${SAMPLE_CIRCLE}/compose` },
  { title: 'Sunday share', href: `/circle/${SAMPLE_CIRCLE}/sunday` },
  { title: 'Spotlight', href: `/circle/${SAMPLE_CIRCLE}/spotlight` },
  { title: 'Birthdays & moments', href: `/circle/${SAMPLE_CIRCLE}/birthdays` },
  { title: 'Hangout ideas', href: `/circle/${SAMPLE_CIRCLE}/hangouts` },
  { title: 'Demo controls (dev)', href: '/demo' },
];

export default function ScreenMap() {
  return (
    <Screen title="Sunny Side Up" note={`Screen map (Phase 0). Data source: ${USE_MOCKS ? 'mocks' : 'Supabase'}.`}>
      {routes.map((r) => (
        <ListItem key={r.title} title={r.title} onPress={() => router.push(r.href)} />
      ))}
    </Screen>
  );
}
