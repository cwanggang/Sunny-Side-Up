import { Redirect, useLocalSearchParams } from 'expo-router';

// The circle page is the coop's carton page (design v0.4/v0.5): members, invite code, and every
// coop page (feed, events, gallery, daily, today's photo, sunny sunday, birthdays, hangouts).
export default function CircleRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/circle/${id}/coop`} />;
}
