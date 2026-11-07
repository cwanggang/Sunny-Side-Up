// B2.1: push for every new interaction. Called by the interactions_push_webhook trigger.
// Directed (recipient_id set) -> just the recipient. Otherwise -> every member except the sender.
// Recipients who paused (consents.paused_until in the future) get no push (B2.2).
import { adminClient } from '../_shared/supabase.ts';
import { pushToUsers } from '../_shared/push.ts';
import { json, verifyWebhook, type WebhookPayload } from '../_shared/http.ts';
import { interactionCopy, type InteractionKind } from '../_shared/copy.ts';

interface InteractionRecord {
  id: string;
  circle_id: string;
  sender_id: string;
  recipient_id: string | null;
  kind: InteractionKind;
  body: string | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!(await verifyWebhook(req))) return json({ error: 'unauthorized' }, 401);

  const payload = (await req.json()) as WebhookPayload<InteractionRecord>;
  const rec = payload.record;
  if (payload.type !== 'INSERT' || !rec) return json({ ok: true, skipped: 'not an insert' });

  const db = adminClient();

  let recipients: string[];
  if (rec.recipient_id) {
    recipients = rec.recipient_id === rec.sender_id ? [] : [rec.recipient_id];
  } else {
    const { data, error } = await db
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', rec.circle_id)
      .neq('user_id', rec.sender_id);
    if (error) return json({ error: error.message }, 500);
    recipients = (data ?? []).map((r) => r.user_id as string);
  }

  if (recipients.length > 0) {
    const { data: paused } = await db
      .from('consents')
      .select('user_id')
      .in('user_id', recipients)
      .gt('paused_until', new Date().toISOString());
    const pausedIds = new Set((paused ?? []).map((r) => r.user_id as string));
    recipients = recipients.filter((id) => !pausedIds.has(id));
  }
  if (recipients.length === 0) return json({ ok: true, sent: 0 });

  const [{ data: sender }, { data: circle }] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', rec.sender_id).single(),
    db.from('circles').select('name').eq('id', rec.circle_id).single(),
  ]);

  const copy = interactionCopy({
    kind: rec.kind,
    senderName: (sender?.display_name as string | undefined) ?? '',
    circleName: (circle?.name as string | undefined) ?? 'Sunny Side Up',
    directed: rec.recipient_id !== null,
    body: rec.body,
  });

  const result = await pushToUsers(recipients, {
    ...copy,
    data: { type: 'interaction', circle_id: rec.circle_id, target_id: rec.id },
  });
  return json({ ok: true, recipients: recipients.length, ...result });
});
