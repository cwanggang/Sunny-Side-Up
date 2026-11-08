import { useLocalSearchParams } from 'expo-router';

import { GalleryScreen } from '@/components/GalleryScreen';

export default function CoopGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GalleryScreen circleId={id} page="gallery" />;
}
