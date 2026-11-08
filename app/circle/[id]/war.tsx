import { useLocalSearchParams } from 'expo-router';

import { EggWarScreen } from '@/components';

// The egg war page: vote, live (leaderboard + feed, the yolk is the camera), called off, over.
export default function WarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EggWarScreen circleId={id} mode="war" />;
}
