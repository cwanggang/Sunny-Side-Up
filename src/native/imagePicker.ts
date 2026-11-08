// Photo library picker and camera. Both return a local JPEG file URI, or null if cancelled.
// Compression: JPEG quality 0.6 keeps a phone photo around 0.5–2 MB (bucket limit is 20 MB).
// Real resizing would need expo-image-manipulator, a new native module (= reinstall on every phone).
import * as ImagePicker from 'expo-image-picker';

export interface PickOptions {
  /** Square crop (profile photos). */
  square?: boolean;
}

const common = (options?: PickOptions): ImagePicker.ImagePickerOptions => ({
  mediaTypes: ['images'],
  allowsEditing: !!options?.square,
  aspect: options?.square ? [1, 1] : undefined,
  quality: 0.6,
  exif: false,
  // JPEG instead of HEIC, so uploads match their .jpg paths and every viewer can show them.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
});

export async function pickImage(options?: PickOptions): Promise<string | null> {
  // iOS's photo picker runs out of process, so no photo-library permission prompt is needed.
  const result = await ImagePicker.launchImageLibraryAsync(common(options));
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

export async function captureImage(options?: PickOptions): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is off. Turn it on in Settings → Sunny Side Up → Camera.');
  }
  const result = await ImagePicker.launchCameraAsync(common(options));
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
