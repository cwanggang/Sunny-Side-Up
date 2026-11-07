import { adminClient } from './supabase.ts';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Database webhooks (our pg_net triggers) send x-webhook-secret; the value lives only in Vault. */
export async function verifyWebhook(req: Request): Promise<boolean> {
  const secret = req.headers.get('x-webhook-secret');
  if (!secret) return false;
  const { data, error } = await adminClient().rpc('verify_webhook_secret', { p_secret: secret });
  if (error) {
    console.error('verify_webhook_secret failed', error.message);
    return false;
  }
  return data === true;
}

/** Demo controls (plan §4.2): only when x-demo-key matches the DEMO_KEY secret. Off if unset. */
export function isDemoRequest(req: Request): boolean {
  const expected = Deno.env.get('DEMO_KEY');
  const got = req.headers.get('x-demo-key');
  if (!expected || !got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Shape of the payload our webhook triggers send (same as Supabase database webhooks). */
export interface WebhookPayload<T> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: T | null;
  old_record: T | null;
}
