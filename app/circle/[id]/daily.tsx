import { useLocalSearchParams } from 'expo-router';

import { GalleryScreen } from '@/components/GalleryScreen';

export default function CoopDailyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GalleryScreen circleId={id} page="daily" />;
}
