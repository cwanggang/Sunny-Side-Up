// B1.3: send a test notification to one account, to check that it shows up on their phone.
//
//   cd scripts && npm run notify-test -- someone@gmail.com
//
// The account must be in at least one circle, and have the app open. Uses the linked Supabase
// project via the CLI (asks for confirmation on the hosted project unless you add --yes).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const email = args.find((a) => !a.startsWith('--'));
if (!email || !/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) {
  console.error('Usage: npm run notify-test -- <email> [--yes]');
  process.exit(2);
}

// SQL goes in a temp file (-f) so no shell ever re-splits or re-quotes it.
const dir = mkdtempSync(join(tmpdir(), 'notify-test-'));
const file = join(dir, 'notify.sql');
writeFileSync(file, `select private.send_test_notification('${email}') as notification_id;
`);
const res = spawnSync('npx', ['supabase', 'db', 'query', '--remote', ...(yes ? ['--yes'] : []), '-f', file], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
rmSync(dir, { recursive: true, force: true });
process.exit(res.status ?? 1);
