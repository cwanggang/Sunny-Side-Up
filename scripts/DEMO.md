# Demo runbook (backend side)

Cast (plan P0.14, 3 phones: the free Personal Team's limit): **Ella** = quiet member · **Jocelyn** = gets the nudge · **Caden** = friend.
`npm run …` commands run in `scripts/` (needs `scripts/.env`, see `.env.example`); `npx supabase …`
commands run from the repo root.

## Once, before demo day

1. **All three sign up in the app** with their P0.14 emails (email + password).
2. Check: `npm run demo-status`. All three rows should show `signed_up: true` (done: they're signed up).
3. *(Optional)* real photos: put 3 to 6 `.jpg` files in `scripts/demo-photos/`, then run the
   rehearsal reseed and the upload (the uploader must be a demo-circle member):
   ```
   npx supabase db query --remote -f scripts/seed-demo-rehearsal.sql   # repo root: test accounts in the demo circle
   cd scripts && npm run upload-demo-photos
   ```
   Placeholder photos are already uploaded, so you can skip this.
4. **Load the real demo:** press **1. Reset demo** in the app's demo screen, or run
   `npx supabase db query --remote -f scripts/seed-demo.sql` (repo root).
   `demo-status` should now show `next_step: ready` for all three.
5. Every demo phone: open the app, sign in, open the **Sunny Side Up Demo** circle once.

## The demo itself (about 2 minutes)

| Step | Who | What happens |
| --- | --- | --- |
| 0 | Jocelyn's phone | **App open** (notifications only show while the app runs) |
| 1 | Demo screen | **1. Reset demo**: 3 weeks of history, Ella's activity fades over the last 3 days |
| 2 | Show the feed | Eggs, texts, photos, last Sunday's shares |
| 3 | Demo screen | **2. Run drift + nudge** |
| 4 | Jocelyn's phone | Notification: something like *"Ella would love a hello from you today"* |
| 5 | Ella's phone | Nothing about it (she never sees that she was flagged) |
| 6 | Informer | Engagement chart dips over the last 3 days, without saying who |
| 7 *(optional)* | Demo screen | **Sunday 10:30 am**: Sunday-share prompt + spotlight on every phone |

**Design flows (also set up by Reset demo):**

| Who | What they see after Reset demo | Live moment |
| --- | --- | --- |
| Jocelyn | Today is **her day** for the daily photo (not posted yet). Daily shows the last 6 days' photos (Ella skipped hers 2 days ago) | Post today's photo → Ella and Caden get *"Jocelyn's photo is up 📷"* |
| Jocelyn | Sunday: **Caden's egg is waiting** (gift), can't open it yet. Her person is Ella | Send her egg to Ella → Caden's egg opens for her |
| Caden | Sunday: sent his egg to Jocelyn, **"still frying"** (waiting on Ella, who sends to him) | — |
| Ella | Sunday: **uncracked** egg; her person is Caden | Crack → see who you're sending to |
| Everyone | Events: **dumpling night** (Caden leads, chat with messages), **farmers market run** (Jocelyn leads, in 2 days), **movie marathon** (past, album + closed chat). Gallery with the demo photos. Coop page carton with three eggs | Open the event chat and send a message → the others get it as a notification |

Sunday is a 3-person ring (Caden → Jocelyn → Ella → Caden), so everyone sends one egg and gets one.

Talking points: drift and "cover" nudges are worded by the same prompt and look identical, so a
nudge never reveals that someone went quiet. Only counts and timing are used, never message content.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| "Demo accounts not signed up yet: …" | That person signs up in the app, then **Reset demo** again |
| "Demo key rejected" | `EXPO_PUBLIC_DEMO_KEY` in `.env.local` must equal the `DEMO_KEY` Supabase secret; restart Metro |
| Run drift + nudge says "0 nudges sent" | It was already run since the last reset (48 h rule). **Reset demo**, then run it again |
| Jocelyn sees nothing | Is the app open and signed in as Jocelyn? Pull to refresh / reopen the app (it fetches missed notifications on foreground) |
| Test a phone's notifications | `npm run notify-test -- <email> --yes` |

## Rehearse without the real cast

`npx supabase db query --remote -f scripts/seed-demo-rehearsal.sql` (repo root) runs the same demo
with 4 test accounts (maya = quiet, sam = gets the nudge; password `sunnyside-test`). Sign in as
sam on a phone to watch the nudge arrive. **This removes the real cast from the demo circle**;
Reset demo with the real cast afterwards.
