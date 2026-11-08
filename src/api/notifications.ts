// A1.4: the server inserts `notifications` rows (no remote push on a free Apple ID, plan §3.0).
// This hook listens to my own rows over Realtime and shows each one as a local notification.
// iOS closes the socket soon after the app is backgrounded, so every return to the foreground
// also fetches anything still unread. A row is marked read (read_at) once it has been shown.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { configureForegroundNotifications, ensureNotificationPermission, showLocalNotification } from '@/native';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { channelName } from './realtime';
import type { AppNotification } from './types';

const MAX_KEPT = 50;

export function useNotifications(): { unread: AppNotification[] } {
  const userId = useUserId();
  // Delivered during this app run, newest first, tagged with whose they are so a sign-out
  // or account switch never shows the previous user's list. Nothing reads this list yet; tapped banners route via A2.5.
  const [delivered, setDelivered] = useState<{ userId: string | null; items: AppNotification[] }>({
    userId: null,
    items: [],
  });

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    const seen = new Set<string>();
    let active = true;
    let canShow = false;

    const deliver = async (rows: AppNotification[]) => {
      const fresh = rows.filter((r) => !r.read_at && !seen.has(r.id));
      if (!active || fresh.length === 0) return;
      fresh.forEach((r) => seen.add(r.id));
      setDelivered((prev) => ({
        userId,
        items: [...[...fresh].reverse(), ...(prev.userId === userId ? prev.items : [])].slice(0, MAX_KEPT),
      }));
      if (canShow) {
        for (const r of fresh) {
          await showLocalNotification({
            title: r.title,
            body: r.body,
            data: { notificationId: r.id, type: r.type, circleId: r.circle_id, targetId: r.target_id },
          }).catch((e) => console.warn('local notification failed', e));
        }
      }
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in(
          'id',
          fresh.map((r) => r.id),
        );
      if (error) console.warn('mark notifications read failed', error.message);
    };

    const fetchUnread = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at')
        .limit(20);
      if (error) console.warn('fetch notifications failed', error.message);
      else await deliver(data);
    };

    const channel = supabase.channel(channelName(`notifications:${userId}`));

    (async () => {
      configureForegroundNotifications();
      canShow = await ensureNotificationPermission().catch(() => false);
      if (!active) return;
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => void deliver([payload.new as AppNotification]),
        )
        .subscribe((status) => {
          // Also covers reconnects: anything inserted while the socket was down is fetched here.
          if (status === 'SUBSCRIBED') void fetchUnread();
        });
    })();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchUnread();
    });

    return () => {
      active = false;
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unread: delivered.userId === userId ? delivered.items : [] };
}
