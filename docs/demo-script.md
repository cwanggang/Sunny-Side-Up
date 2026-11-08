# Demo script (about 3 minutes)

> Draft by Developer B, 2026-11-08. Backend setup and troubleshooting: `scripts/DEMO.md`.
> Screen names follow the v0.5 design; adjust the "tap" lines once Developer A's redesign lands.

**Phones:** Ella (quiet member), **Jocelyn (gets the nudge: app open the whole time)**, Caden.
**Laptop:** Informer dashboard open in a tab. A backup screen recording ready.

## Before you go on (5 minutes before)

1. Every phone: app open, signed in, on home.
2. Demo screen → **Reset demo**. Then `cd scripts && npm run demo-status`: all three say
   *tap "Run drift + nudge"*, which is the ready state.
3. Informer (`https://018mbojwu.go.informer.cloud/`, Reports → **Sunny Side Up: coop health**): press
   **Reload** (Informer caches dataset results). The line should dip at the end and the alert table
   should show one row.

## The pitch

| Time | Say | Do |
| --- | --- | --- |
| 0:00 | "Friend groups don't end in a fight. They fade: one person goes quiet, and by the time anyone notices it's been weeks." | Title slide |
| 0:15 | "Sunny Side Up is a tiny daily ritual for your closest friends. Every day one of you is up." | Jocelyn's phone: home, **it's your day** → take today's photo → write on the egg → send |
| 0:35 | "Everyone else just reacts." | Caden's phone: the notification arrives → react ❤️ |
| 0:50 | "On Sundays you're secretly paired with one friend, and you can only open their egg after you send yours." | Jocelyn: sunny sunday → Caden's egg is waiting but locked → send hers to Ella → it cracks open |
| 1:15 | "And sometimes you just play." | Caden's egg war: Jocelyn opts in, Ella opts out → the war starts. Snipe Caden → he gets *"you got egged"* |
| 1:35 | "Here's the part you can't see. Ella's been busy. Her activity has dropped over the last three days compared with her own normal." | Informer: the coop's engagement line dips; the alert row shows a drop with no names |
| 1:55 | "Every night we compare each person with their own baseline. Watch Jocelyn's phone." | Demo screen → **Run drift + nudge** |
| 2:05 | "Jocelyn just gets a friendly nudge: *'Ella would love a voice memo today.'* Ella sees nothing." | Hold up Jocelyn's phone, then Ella's (nothing) |
| 2:20 | "Jocelyn can't tell this is real. We send random cover nudges about people who are fine, using the exact same AI prompt. The reason never leaves our server." | — |
| 2:35 | "Raw location and health data never leave the phone, we never read messages, and nothing anywhere says 'lonely'. Informer only sees de-identified counts." | Settings: consent toggles, pause, 988 link |
| 2:50 | "Sunny Side Up: keep your people close, and notice when someone drifts." | End slide |

## If something breaks on stage

- **No nudge on Jocelyn's phone after ~5 s:** pull to refresh / reopen the app (it fetches missed
  notifications on return). If the demo screen says *0 nudges sent*, it was already run: **Reset
  demo** and run again.
- **Egg war doesn't go live:** both Jocelyn and Ella must vote (it resolves as soon as everyone has).
- **Anything else:** switch to the backup recording and keep talking.

## Likely judge questions

- *Isn't this surveillance?* Opt-in per signal, the raw data stays on the phone, it can be paused, and
  friends never learn why. The quiet person can switch off nudges about themselves.
- *What if someone is in real trouble?* The app isn't a crisis service. Consent and settings link to
  988, and a nudge only ever suggests a small friendly action.
- *Why an LLM?* Varied, natural wording makes cover nudges and real ones impossible to tell apart.
  It only sees a first name and the coop name.
- *What does Informer add?* A de-identified view for whoever runs the community: which coops are
  thriving, which are fading, and an alert when one dips. No names.
