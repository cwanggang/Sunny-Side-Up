# Demo runbook (backend side)

Cast (plan P0.14): **Ella** = quiet member · **Valerie** = gets the nudge · Caden, Johnathon = friends.
`npm run …` commands run in `scripts/` (needs `scripts/.env`, see `.env.example`); `npx supabase …`
commands run from the repo root.

## Once, before demo day

1. **All four sign up in the app** with their P0.14 emails (email + password).
2. Check: `npm run demo-status`. All four rows should show `signed_up: true`.
3. *(Optional)* real photos: put 3 to 6 `.jpg` files in `scripts/demo-photos/`, then run the
   rehearsal reseed and the upload (the uploader must be a demo-circle member):
   ```
   npx supabase db query --remote -f scripts/seed-demo-rehearsal.sql   # repo root: test accounts in the demo circle
   cd scripts && npm run upload-demo-photos
   ```
   Placeholder photos are already uploaded, so you can skip this.
4. **Load the real demo:** press **1. Reset demo** in the app's demo screen, or run
   `npx supabase db query --remote -f scripts/seed-demo.sql` (repo root).
   `demo-status` should now show `in_demo_circle: true` for all four.
5. Every demo phone: open the app, sign in, open the **Sunny Side Up Demo** circle once.

## The demo itself (about 2 minutes)

| Step | Who | What happens |
| --- | --- | --- |
| 0 | Valerie's phone | **App open** (notifications only show while the app runs) |
| 1 | Demo screen | **1. Reset demo**: 3 weeks of history, Ella's activity fades over the last 3 days |
| 2 | Show the feed | Eggs, texts, photos, last Sunday's shares |
| 3 | Demo screen | **2. Run drift + nudge** |
| 4 | Valerie's phone | Notification: something like *"Ella would love a hello from you today"* |
| 5 | Ella's phone | Nothing about it (she never sees that she was flagged) |
| 6 | Informer | Engagement chart dips over the last 3 days, without saying who |
| 7 *(optional)* | Demo screen | **Sunday 10:30 am**: Sunday-share prompt + spotlight on every phone |

**Design v0.3 flows (also set up by Reset demo):**

| Who | What they see after Reset demo | Live moment |
| --- | --- | --- |
| Valerie | Today is **her day** for the daily photo (not posted yet). Group stack shows the last 6 days' photos (Ella skipped hers 3 days ago) | Post today's photo → the other three get *"Valerie's photo is up 📷"* |
| Johnathon | Sunday: **Caden's egg is waiting** (gift), can't open it yet | Send his own egg to Caden → Caden's egg opens for him, Caden gets *"Johnathon sent you an egg 🥚 tap to open it"* |
| Caden | Sunday: sent, **"still frying"**, waiting on Johnathon | Opens Johnathon's egg after the step above |
| Valerie, Ella | Sunday: **uncracked** egg (each other's person, so the quiet member is paired with a friend) | Crack → see who you're sending to |

Talking points: drift and "cover" nudges are worded by the same prompt and look identical, so a
nudge never reveals that someone went quiet. Only counts and timing are used, never message content.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| "Demo accounts not signed up yet: …" | That person signs up in the app, then **Reset demo** again |
| "Demo key rejected" | `EXPO_PUBLIC_DEMO_KEY` in `.env.local` must equal the `DEMO_KEY` Supabase secret; restart Metro |
| Run drift + nudge says "0 nudges sent" | It was already run since the last reset (48 h rule). **Reset demo**, then run it again |
| Valerie sees nothing | Is the app open and signed in as Valerie? Pull to refresh / reopen the app (it fetches missed notifications on foreground) |
| Test a phone's notifications | `npm run notify-test -- <email> --yes` |

## Rehearse without the real cast

`npx supabase db query --remote -f scripts/seed-demo-rehearsal.sql` (repo root) runs the same demo
with the test accounts (maya = quiet, sam = gets the nudge; password `sunnyside-test`). Sign in as
sam on a phone to watch the nudge arrive. Reset with the real cast afterwards.
