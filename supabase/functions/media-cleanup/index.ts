// B2.3: remove a media file from Storage once nothing points at it any more.
// Called by triggers when an interaction or share is deleted (including cascades from
// account/circle deletion) and when a share photo or avatar is replaced.
import { adminClient } from '../_shared/supabase.ts';
import { json, verifyWebhook, type WebhookPayload } from '../_shared/http.ts';
import { MEDIA_BUCKET } from '../_shared/contract.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!(await verifyWebhook(req))) return json({ error: 'unauthorized' }, 401);

  const payload = (await req.json()) as WebhookPayload<{ media_path?: string | null }>;
  const path = payload.old_record?.media_path;
  if (!path) return json({ ok: true, skipped: 'no media' });

  const db = adminClient();
  // Safety: keep the file if any row still references it.
  const [i, s, p] = await Promise.all([
    db.from('interactions').select('id', { count: 'exact', head: true }).eq('media_path', path),
    db.from('shares').select('id', { count: 'exact', head: true }).eq('media_path', path),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('avatar_path', path),
  ]);
  if ((i.count ?? 0) + (s.count ?? 0) + (p.count ?? 0) > 0) {
    return json({ ok: true, skipped: 'still referenced' });
  }

  const { error } = await db.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, removed: path });
});
