// Local notifications only (free Apple ID: no remote push, plan.md §3.0).
import * as Notifications from 'expo-notifications';

let configured = false;

/** Show banners even while the app is open (that's the main case on a free-signed build). */
export function configureForegroundNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Asks once; returns whether local notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Shows a notification immediately. `data` is handed back when it's tapped (A2.5). */
export async function showLocalNotification(input: {
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: input.title, body: input.body, data: input.data },
    trigger: null,
  });
}
