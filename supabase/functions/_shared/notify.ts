// B1.3: the one way Edge Functions tell someone something (plan §4.2 "Notification shape").
// Inserts `notifications` rows through public.create_notifications(), which skips users whose
// consents.paused_until is in the future. The app shows each row as a local notification.
// If a paid Apple account appears later, this is also where a real push would be sent.
import { adminClient } from './supabase.ts';
import type { NotificationType } from './contract.ts';

export interface NotificationRow {
  user_id: string;
  type: NotificationType;
  circle_id: string;
  target_id?: string | null;
  title: string;
  body: string;
}

/** Returns how many rows were created (paused users are skipped). */
export async function notify(rows: NotificationRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await adminClient().rpc('create_notifications', { p_rows: rows });
  if (error) throw new Error(`create_notifications: ${error.message}`);
  return (data as number) ?? 0;
}
