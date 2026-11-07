import { router, useLocalSearchParams } from 'expo-router';

import { ListItem, Screen } from '@/components';

// A0.3 placeholder. Built in A1.5 (members, invite share sheet, home area).
export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sections = [
    { title: 'Feed', path: 'feed' },
    { title: 'Send something', path: 'compose' },
    { title: 'Sunday share', path: 'sunday' },
    { title: 'Spotlight', path: 'spotlight' },
    { title: 'Birthdays & moments', path: 'birthdays' },
    { title: 'Hangout ideas', path: 'hangouts' },
  ] as const;

  return (
    <Screen title="Circle" note={`Baseline screen: built in A1.5. Circle id: ${id}`}>
      {sections.map((s) => (
        <ListItem key={s.path} title={s.title} onPress={() => router.push(`/circle/${id}/${s.path}`)} />
      ))}
    </Screen>
  );
}
