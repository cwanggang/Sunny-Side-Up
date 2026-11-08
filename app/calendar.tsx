import { Screen } from '@/components';
import { EventsView } from '@/components/EventsView';

// Design v0.4 calendar across all my coops (Developer B).
export default function CalendarScreen() {
  return (
    <Screen title="calendar">
      <EventsView circleId={null} />
    </Screen>
  );
}
