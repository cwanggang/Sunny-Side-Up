# Sunny Side Up: Devpost write-up (draft)

> Draft by Developer B, 2026-11-08. Fill in the team names and links; check the "Built with" list
> against what is actually in the final demo.

## Tagline

A tiny daily ritual for your closest friends, and a quiet safety net when one of them drifts away.

## Inspiration

Friend groups don't fall apart in a fight. They fade. Someone gets busy, stops posting, stops
replying, and by the time anyone notices it has been weeks. Group chats are loud for the people who
are already talking and silent for the one who isn't. We wanted something small and warm enough to
open every day, which could also notice when a friend goes quiet and get someone to reach out,
**without ever telling anyone that it noticed.**

## What it does

Sunny Side Up is an iPhone app for small friend groups ("coops").

- **Today's photo:** each day one person in the coop is up. They answer the day's prompt with a photo,
  "write on their egg", and everyone else reacts.
- **Sunny Sunday:** every Sunday you're secretly paired with one friend. You send them a voice memo or
  video in a decorated egg. You can only crack theirs open once you've sent yours.
- **Little things:** send an egg, a photo, a voice memo or a text, to one person or the whole coop.
  Birthdays, "interview on Tuesday" moments, events with a temporary group chat and a shared album,
  and AI hangout ideas for your area.
- **Egg war:** an opt-in game. Once more than half the coop says yes, everyone has 3 days to snap candid
  "snipes" of each other, with a leaderboard. Everything is deleted when it ends.
- **Quiet nudges:** every night the server compares each person's activity over the last 3 days with
  their own 14-day baseline. If someone has gone quiet, one friend gets a friendly nudge:
  *"Ella would love a silly voice memo from the crew today, go say hi! 🍳"*. The quiet person sees
  nothing, and the friend never learns why.

## Privacy is the feature

A system that notices when people withdraw could easily become creepy, so we built the rules first:

- **Nobody learns why a nudge was sent.** The app also sends random *cover nudges* about people who
  are fine. Drift and cover nudges use the **same LLM prompt with the same inputs** (a first name and
  the coop name), and their notification rows look identical. The reason is stored only on the
  server and never sent to a phone.
- **Raw location and health data never leave the phone.** The phone turns them into two or three daily
  numbers (hours away from home, places visited, sleep, steps), and only those are uploaded, only
  with consent.
- **No message content is analyzed.** Drift uses counts and timing only.
- **No labels.** Nothing in the database or the UI says "lonely" or "depressed". The model's output
  is filtered for words like that, and also for pronouns, since we don't know anyone's.
- **Pause and consent** gate everything. Settings links to the 988 Suicide & Crisis Lifeline; friends
  are not the emergency plan.
- **Analytics are de-identified.** Entrinsik Informer reads a separate `analytics` schema through a
  read-only role: hashed coop keys and counts, never names, photos or the drift-vs-cover split.

## How we built it

- **App:** Expo SDK 58 (React Native 0.88, TypeScript, Expo Router), built locally with Xcode and a
  **free Apple ID**. Every screen gets its data from one typed `@/api` layer, so the UI could be
  redesigned late without touching data code.
- **Backend:** Supabase. Postgres with row-level security on every table, Storage for media,
  Realtime, Edge Functions on Deno, and pg_cron for the nightly drift job, the hourly scheduler and
  the egg war resolver.
- **AI:** Claude (Haiku) writes the nudge wording, the hangout ideas and the profile fact prompts. Every
  call happens on the server, with a timeout, schema-validated output and a fallback, so a slow model
  never breaks a notification.
- **Analytics:** Entrinsik Informer on top of de-identified views. We chart coop engagement over time
  and alert when a coop's engagement drops 20% below its own baseline.

## Challenges we ran into

- **No push notifications on a free Apple ID.** The server writes rows into a `notifications` table.
  The app listens over Supabase Realtime and shows each one as a local notification, and it
  catches up on anything missed when it returns to the foreground.
- **Making the "why" impossible to leak.** That shaped the database (`reason_kind` is server-only,
  clients read nudges through a view), the LLM wrapper (no parameter exists for a reason) and the
  analytics (no drift/cover split).
- **Row-level security that doesn't recurse.** Membership checks go through `SECURITY DEFINER`
  helpers. A 124-check script signs in as test users and tries to read what they shouldn't.
- **A demo that needs 17 days of history.** Drift compares 3 days with a 14-day baseline, so a
  one-button reset backfills realistic history for the real demo accounts.
- **Two developers, 36 hours, zero merge conflicts.** Strict folder ownership plus a shared
  contract folder that changes only by agreement.

## Accomplishments we're proud of

- The full loop works on real phones: a friend's activity fades → the nightly job flags it → a
  different friend gets a natural, LLM-written nudge → the quiet friend sees nothing.
- 124 automated row-level-security checks pass against the live database.
- Every AI feature degrades gracefully: no key, a timeout or a refusal still gives a sensible
  result.

## What we learned

Privacy rules are easier to keep when they're built into the shape of the system (who can read which
column, which parameters a function takes) than when they're written as policy text.

## What's next

- Run the drift model on the phone, so even the daily numbers stay local.
- Real push notifications once we have a paid Apple Developer account. The `notifications` table
  stays the source of truth, so no app changes are needed.
- Measure (de-identified) whether nudges actually lead to people reaching out: friends can already
  mark a nudge as acted on, and Informer has the daily counts.

## Built with

expo · react-native · typescript · supabase · postgresql · deno · claude · anthropic · entrinsik-informer · xcode
