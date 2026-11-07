// B4.6: delete the caller's account. Called by the app with the user's JWT.
//   1. Leave every circle via leave_circle (hands ownership on, deletes circles left empty).
//   2. Delete every file they uploaded (interaction/share media + avatars).
//   3. Delete the auth user -> cascades to profiles and every row that references them
//      (interactions, reactions, shares, moments, signals, engagement, scores, nudges).
//      Media of cascaded rows is also cleaned by the media-cleanup triggers.
import { adminClient, userClient } from '../_shared/supabase.ts';
import { json } from '../_shared/http.ts';
import { MEDIA_BUCKET, type DeleteAccountResponse } from '../_shared/contract.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return json({ error: 'not signed in' }, 401);

  const admin = adminClient();

  const { data: memberships, error: mErr } = await asUser.from('circle_members').select('circle_id').eq('user_id', uid);
  if (mErr) return json({ error: mErr.message }, 500);
  for (const m of memberships ?? []) {
    const { error } = await asUser.rpc('leave_circle', { circle_id: m.circle_id });
    if (error) return json({ error: `leave_circle: ${error.message}` }, 500);
  }

  const { data: paths, error: pErr } = await admin.rpc('user_media_paths', { p_user_id: uid });
  if (pErr) return json({ error: pErr.message }, 500);
  const files = (paths ?? []) as string[];
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(MEDIA_BUCKET).remove(files.slice(i, i + 100));
    if (error) return json({ error: `storage: ${error.message}` }, 500);
  }

  const { error: dErr } = await admin.auth.admin.deleteUser(uid);
  if (dErr) return json({ error: dErr.message }, 500);

  const response: DeleteAccountResponse = { ok: true };
  return json(response);
});
