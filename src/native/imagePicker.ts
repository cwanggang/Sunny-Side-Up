// Photo library picker. Returns a local JPEG file URI, or null if the user cancelled.
// (A2.3 adds camera capture and resizing; this is the minimal picker A1.5's profile photo needs.)
import * as ImagePicker from 'expo-image-picker';

export async function pickImage(options?: { square?: boolean }): Promise<string | null> {
  // iOS's photo picker runs out of process, so no photo-library permission prompt is needed.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options?.square,
    aspect: options?.square ? [1, 1] : undefined,
    quality: 0.7,
    // JPEG instead of HEIC, so uploads match their .jpg paths and every viewer can show them.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
