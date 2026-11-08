import { useLocalSearchParams } from 'expo-router';

import { EggWarScreen } from '@/components';

// play!: the egg war landing page (initiate, or join the one that's going).
export default function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EggWarScreen circleId={id} mode="play" />;
}
