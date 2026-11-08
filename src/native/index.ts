// Wrappers around native modules: location, health, notifications, camera, audio, linking.
// Only src/api (and src/signals) import from here; screens never do (plan.md §0.4).
export { MAX_VOICE_SECONDS, useNativeAudioPlayer, useNativeVoiceRecorder } from './audio';
export { captureImage, pickImage, type PickOptions } from './imagePicker';
export {
  configureForegroundNotifications,
  ensureNotificationPermission,
  showLocalNotification,
  subscribeToNotificationTaps,
} from './notifications';
