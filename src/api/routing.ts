// A2.5: tapping a local notification opens the matching screen, using the data that
// useNotifications attached: { type, circleId, targetId } from the `notifications` row.
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { subscribeToNotificationTaps } from '@/native';

import type { NotificationType } from './types';

export function hrefForNotification(type: NotificationType, circleId: string): Href {
  switch (type) {
    case 'interaction':
      return `/circle/${circleId}/feed`;
    case 'nudge':
      return '/nudges';
    case 'share_open':
      return `/circle/${circleId}/sunday`;
    case 'spotlight':
      return `/circle/${circleId}/spotlight`;
    case 'birthday':
    case 'moment':
      return `/circle/${circleId}/birthdays`;
    default:
      return `/circle/${circleId}`;
  }
}

const handled = new Set<string>();

/** Mount once in the root layout. Signed out, the auth gate keeps you on sign-in. */
export function useNotificationRouting(): void {
  useEffect(
    () =>
      subscribeToNotificationTaps((data, id) => {
        // The cold-start tap can be reported by both the listener and the "last response".
        if (handled.has(id)) return;
        handled.add(id);
        const type = data.type as NotificationType | undefined;
        const circleId = typeof data.circleId === 'string' ? data.circleId : null;
        if (!type || !circleId) return;
        // Defer so a cold start has mounted the navigator first.
        setTimeout(() => router.push(hrefForNotification(type, circleId)), 0);
      }),
    [],
  );
}
