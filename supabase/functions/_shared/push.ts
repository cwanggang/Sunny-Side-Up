// B1.3: Expo Push API sender. Batches (100 per request), retries once on 429/5xx,
// and clears tokens Expo reports as DeviceNotRegistered.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
import type { PushPayload } from './contract.ts';
import { adminClient } from './supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;
const TIMEOUT_MS = 10_000;

export interface PushMessage {
  to: string;
  title?: string;
  body: string;
  data: PushPayload;
  sound?: 'default' | null;
  badge?: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  droppedTokens: string[];
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export const isExpoToken = (t: unknown): t is string =>
  typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t);

async function postBatch(batch: PushMessage[]): Promise<ExpoTicket[]> {
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // only needed if "enhanced security" is on in Expo
  if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data?: ExpoTicket[] };
    return json.data ?? [];
  }
  throw new Error('Expo push: retry exhausted');
}

/** Send push messages. Invalid tokens are skipped; dead tokens are cleared from profiles. */
export async function sendPush(messages: PushMessage[]): Promise<PushResult> {
  const valid = messages.filter((m) => isExpoToken(m.to));
  const result: PushResult = { sent: 0, failed: messages.length - valid.length, droppedTokens: [] };

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    try {
      const tickets = await postBatch(batch);
      batch.forEach((msg, j) => {
        const t = tickets[j];
        if (t?.status === 'ok') {
          result.sent++;
        } else {
          result.failed++;
          if (t?.details?.error === 'DeviceNotRegistered') result.droppedTokens.push(msg.to);
          else console.error('push ticket error', t?.message ?? 'missing ticket');
        }
      });
    } catch (err) {
      console.error('push batch failed', err);
      result.failed += batch.length;
    }
  }

  if (result.droppedTokens.length > 0) {
    const { error } = await adminClient()
      .from('profiles')
      .update({ expo_push_token: null })
      .in('expo_push_token', result.droppedTokens);
    if (error) console.error('failed to clear dead push tokens', error.message);
  }
  return result;
}

/** Look up push tokens for these users and send each the same message. */
export async function pushToUsers(
  userIds: string[],
  msg: { title?: string; body: string; data: PushPayload },
): Promise<PushResult> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { sent: 0, failed: 0, droppedTokens: [] };

  const { data, error } = await adminClient()
    .from('profiles')
    .select('id, expo_push_token')
    .in('id', ids)
    .not('expo_push_token', 'is', null);
  if (error) throw new Error(`push token lookup failed: ${error.message}`);

  const messages: PushMessage[] = (data ?? []).map((row) => ({
    to: row.expo_push_token as string,
    title: msg.title,
    body: msg.body,
    data: msg.data,
    sound: 'default',
  }));
  return sendPush(messages);
}
