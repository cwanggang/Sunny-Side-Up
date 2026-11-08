import { useLocalSearchParams } from 'expo-router';

import { useCoop } from '@/api';
import { Screen } from '@/components';
import { EventsView } from '@/components/EventsView';

// Design v0.4 events for one coop (Developer B).
export default function CoopEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coop = useCoop(id);
  return (
    <Screen title={coop ? `${coop.name} · events` : 'events'}>
      <EventsView circleId={id} />
    </Screen>
  );
}
