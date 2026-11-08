import { useLocalSearchParams } from 'expo-router';

import { EventsScreen } from '@/components/EventsScreen';

// One coop's events.
export default function CoopEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventsScreen circleId={id} />;
}
