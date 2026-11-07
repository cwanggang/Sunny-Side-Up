# Sunny Side Up — Concept & Brainstorm Doc

> **Background only: the product vision, not the hackathon scope.** What gets built this weekend is defined in [`plan.md`](plan.md). Several things here are **not** in the hackathon build: Shortcuts / App Intents signals, Screen Time, Core Motion, per-circle sharing levels, mutual opt-in, primary support person, calendar features, and on-device scoring. In the hackathon build, the phone uploads daily summary numbers and drift is scored **on the server** (plan.md §9). Consent copy must describe that, not the "model stays on the phone" design below.

Nov 6, 2026 · @Caden

## Overview

Sunny Side Up is a mobile app that turns a small circle of trusted friends into a support net that works without anyone asking. It reads how a person's days are going from their phone, and when things drift toward isolation or stress, it quietly prompts friends to reach out on their own.

**Direction shift (Nov 6): prevention, not rescue.** The app builds a steady rhythm of small interactions in each circle, every day or two: check-ins, nudges, and sending a friend a symbolic egg. Instead of diagnosing who is lonely, it notices who is engaging less than usual and quietly creates more chances for them to connect, so drift is caught well before it becomes a crisis.

**Engagement rhythm ideas (from Snapchat and Duolingo):** every interaction is tiny and low effort, and it happens on a predictable rhythm rather than daily.

- **Tiny formats:** a photo, a short voice memo, or a symbolic egg. Seconds, not minutes.
- **Every few days, not every day:** for example, every three days.
- **Weekly ritual:** one shared day, such as Sunday, when everyone shares their week.
- **Spotlight days:** each day of the week belongs to one circle member, who shares and gets attention from the rest.
- **Avoid punishing streaks:** missing a day should never cost the user anything, to avoid the anxiety Snapchat streaks are known for.

**Two pillars (agreed with co-builders):**

1. **Bring the group closer.** A friendship app for the circle.
2. **Catch quiet drift.** Notice who is engaging less and create more chances for them to connect.

**Pillar 1 features proposed:**

| Feature | What it does | Tools needed |
| --- | --- | --- |
| Birthdays | Stores each member's birthday and reminds the circle. | Backend database, push notifications |
| Shared calendar and events | Plan hangouts together, with RSVPs. | Backend database |
| Free-time finder | With calendar access, finds times when everyone is free and feeds AI hangout ideas, so a plan is only proposed when people look free enough. Reads only busy/free, never event details. | EventKit on iOS, optionally Google Calendar API |
| Moment shout-outs | A member can flag a big day, such as an interview, so the circle sends good luck. Opt-in per event, never pulled automatically from a calendar. | Backend database, push notifications |
| AI hangout ideas | Suggests things to do and places nearby, matched to the group's free times. | LLM API, Apple MapKit or Google Places API |

**Core features (from the call):** circles with invite links; tiny interactions (photos, voice memos, eggs); rhythm (Sunday share, spotlight days); quiet drift detection from in-app engagement plus location and health data; gentle AI-worded nudges. Stack: Supabase or Firebase, Apple push notifications, camera and microphone, Core Location, HealthKit, an LLM API. Screen Time and Shortcuts tracking deferred.

**The core idea, as described so far:**

- **Circles first.** Users form friend or support groups. Everyone in a circle both supports and is supported.
- **Consent once, up front.** At signup, the user agrees to exactly which signals are read and that their circle may be nudged automatically. After that, nobody has to ask for help.
- **Passive signals.** Location patterns, health data, app-use patterns, and message activity counts. Never message content.
- **On-device AI.** A model compares each day with the user's own normal and estimates whether they seem isolated or stressed.
- **Invisible nudges.** Friends get a natural prompt to reach out, never the reason. Some nudges go out at random when nothing is wrong, so a nudge never reveals that someone is struggling.

**The central tension:** the app only works if people trust it with intimate data. That trust comes from a short, plain data policy users agree to at signup, analysis that stays on the phone, and friends who see a nudge, never the evidence behind it.

**Hackathon reality check:** iOS keeps Screen Time data locked on the phone and offers no direct texting or calling data. App-open, session, and incoming-message signals are still possible through Shortcuts automations the user sets up (see Screen time, texts, and calls).

## How it works

Sunny Side Up runs a quiet loop on the phone: read signals, compare them with the user's own normal, and nudge a friend when something drifts. The user gives consent once at signup, so nobody ever has to ask for help.

&#91;embedded content: Sunny Side Up core loop · signals to nudge\]

1. **Sense.** Location visits, motion, sleep, app-use patterns, and incoming-message counts are collected on the phone.
2. **Compare.** After one to two weeks, the app knows the user's normal and measures drift from it.
3. **Decide.** Green days still produce an occasional random nudge, so nudges never stand out. Yellow nudges the circle automatically and suggests an activity to the user. A reported crisis shows 988 and emergency options.
4. **Connect.** A friend gets a natural prompt to reach out, with no reason attached.

## Functionality

Five groups of features: circles, signals, detection, actions, and user control. Priority is a first guess for the hackathon: **MVP** = demo depends on it, **Stretch** = build if time allows, **Later** = post-hackathon.

### 1. Circles

| Feature | What it does | Priority |
| --- | --- | --- |
| Create and join circles | Make a group, invite friends by link or QR code. A user can belong to several circles (roommates, team, family). | MVP |
| Per-circle sharing levels | The user picks what each circle receives: only "check on me" alerts, a green/yellow/red status, or nothing. | MVP |
| Primary support person | One person per user who gets the first and most direct alert. | Stretch |
| Mutual opt-in | Friends accept the role of supporter, so nobody is surprised by alerts. | MVP |

### 2. Signals (what the app senses)

| Feature | What it does | Priority |
| --- | --- | --- |
| Location patterns | Time at home versus out, number of distinct places visited, and breaks from routine. Uses iOS visit tracking, not a live GPS trail. | MVP |
| Movement | Stationary versus active time from Core Motion. | MVP |
| Health data | Sleep, steps, and resting heart rate from HealthKit, with permission. | MVP |
| App-use patterns | Opens per day, session length, and late-night use for apps the user picks, logged through Shortcuts automations. | MVP |
| Incoming message activity | How many texts arrive and when, logged through a Shortcuts Message automation. Content and sender are discarded. | Stretch |
| Screen time totals | Daily and per-category use from Apple's Screen Time API. Stays on the phone; threshold alerts feed the on-device model. | Stretch |
| Calendar density | Count of social events on the user's calendar, with permission. Titles never leave the phone. | Later |

### 3. Detection

| Feature | What it does | Priority |
| --- | --- | --- |
| Personal baseline | Learns each user's own normal over the first one to two weeks, then watches for drift. Compares you to you, not to other people. | MVP |
| Wellbeing level | Combines signals into green, yellow, or red. The reason stays on the user's phone. | MVP |
| Automatic nudge trigger | At yellow, the circle is nudged without asking the user, as agreed at signup. | MVP |
| Cover nudges | Random nudges on normal days, so receiving a nudge never signals that someone is struggling. | MVP |
| Outcome feedback | After reaching out, the friend can tap how it went. Gives the model a correction signal without a mood diary. | Stretch |
| AI wording | An LLM writes nudge text from the computed level, never from raw data. | Stretch |

### 4. Actions

| Feature | What it does | Priority |
| --- | --- | --- |
| Friend nudge | "You haven't caught up with Caden in a while." Reads like a friendly reminder and gives no reason. | MVP |
| Friend rotation | Spreads nudges across the circle so no one friend carries the load. | Stretch |
| Reach-out starters | One-tap ideas for the friend: send a text, invite to lunch, call. | Stretch |
| Activity suggestions | Ideas for the user based on context: a walk, a campus event, calling someone they haven't talked to in a while. | MVP |
| Group hangout prompts | "Three of your circle are free Saturday afternoon." Turns support into plans. | Later |
| Crisis path | If the user reports being in crisis, the app shows the 988 Suicide & Crisis Lifeline and emergency options right away. Friends are not the safety net for emergencies. | MVP |

### 5. User control

| Feature | What it does | Priority |
| --- | --- | --- |
| What the app saw | A screen showing which signals were used and when nudges went out. | MVP |
| Per-signal toggles | Turn any signal on or off at any time, not just at signup. | MVP |
| Pause and snooze | Turn sensing or nudges off for a day, a week, or indefinitely. | MVP |
| Delete everything | One tap wipes stored data from the phone and server. | Stretch |

## iOS viability

Location, health, and motion data are fully available on iOS. Screen time is available but locked to the phone. App opens and incoming texts can be logged only through Shortcuts automations the user sets up. Calls are barely visible, and outgoing texts are not visible at all.

| Data | Possible on iOS? | How | Verdict |
| --- | --- | --- | --- |
| Places visited and time spent there | Yes | Core Location visit monitoring and geofences (needs "Always" location permission). iOS wakes the app when the user arrives or leaves a place. | Core signal |
| Movement and activity | Yes | Core Motion activity (stationary, walking, driving) and step counts. | Core signal |
| Sleep, steps, heart rate | Yes | HealthKit, with per-type permission. | Core signal |
| Calendar events | Yes | EventKit, with calendar permission. | Optional |
| App opens and session lengths | Yes, with user setup | Shortcuts automations (details below). | Core signal |
| Screen time totals | On the phone only | Screen Time API (details below). | On-device only |
| Incoming texts | Yes, with user setup | Shortcuts Message automation (details below). | Counts only |
| Outgoing texts, DMs in other apps | No | No API or trigger. | Not possible |
| Phone calls | Barely | Only while the app is running (details below). | Skip for v1 |
| Content of messages | Technically, for incoming texts | The Shortcuts Message trigger can pass the text along. | Never collect |

**What this means for the build:**

- **Run detection on the phone.** iOS wakes the app on location and motion events and when a Shortcuts automation fires. Compute the wellbeing level then, and send only "nudge this circle" to the server.
- **Native code matters.** Screen Time, visit monitoring, and App Intents for Shortcuts need Swift. React Native or Expo would need native modules for these, which costs hackathon hours.
- **Android is far more open.** It allows per-app usage stats to be exported. If the team wants the full sensing pitch without user setup, Android is the easier demo platform.

## Screen time, texts, and calls: the details

Short answer to "can I see which apps are opened, how often, and for how long": yes, but not through Apple's Screen Time API. Screen Time computes those numbers and then hides them from your code. Shortcuts automations are the working route.

| Question | Answer | How |
| --- | --- | --- |
| Which apps a person opens | Yes, two ways | Screen Time shows app names, but only drawn on screen inside a sandboxed view your code can't read. A Shortcuts automation logs each app the user sets up. |
| How often an app is opened | Only via Shortcuts | Screen Time tracks pickups per app, but Apple says this is not available to apps [for privacy reasons](https://developer.apple.com/forums/thread/770841). An "App is Opened" automation logs every open with a timestamp. |
| How long each session lasts | Only via Shortcuts | Screen Time gives total time per app per hour or day, not individual sessions. Pairing "Is Opened" and "Is Closed" automations gives exact session lengths. |
| Total screen time per day | On the phone only | The report extension sees it, and the monitor extension fires alerts like "social apps passed 3 hours." Apple's developer agreement (section 3.3.3(P)) bars sharing usage data received through Family Controls ([forum quote](https://origin-devforums.apple.com/forums/tags/family-controls)). |
| Incoming texts (iMessage, SMS) | Yes, via Shortcuts | A Message automation fires on each received message and can run without asking ([Apple Support](https://support.apple.com/en-gu/guide/shortcuts/apdd711f9dff/ios)). The app logs only a timestamp. |
| Outgoing texts | No | No trigger or API exists. |
| DMs in Instagram, Snapchat, WhatsApp | No | Only app-open and session data for those apps. |
| Phone calls | Barely | CallKit's call observer sees calls start and end only while the app is running; a call cannot wake the app ([Apple forums](https://developer.apple.com/forums/thread/849682)). No phone numbers. |

**The Shortcuts route, honestly:**

- **It is proven.** The app one sec uses "Is Opened" and "Is Closed" automations with Run Immediately to time app sessions ([one sec help](https://feedback.one-sec.app/help/articles/1259797)).
- **Setup is manual.** One automation per app per event. The app cannot create automations itself; it can only walk the user through. Onboarding friction is the main cost, so ask for 3 to 5 apps, not 30.
- **It is the user's choice, visibly.** Users can see and delete each automation in the Shortcuts app. That transparency is a trust feature.
- **It is not Family Controls data.** The app receives events the user chose to send, so the Screen Time sharing restriction does not apply. App Store privacy rules and disclosure still do.
- **Hackathon build:** three App Intents: "Log app opened", "Log app closed", and "Log message received". The message intent has no parameter for content or sender, so it is impossible to collect them by accident.

## Data policy

This is the draft of what users agree to at signup. Collect patterns, never content. Keep raw data on the phone. Give friends a nudge, never the evidence behind it.

| Data | Collect? | Policy: where it lives, what it is used for, who sees it |
| --- | --- | --- |
| Places and time spent | Yes | Raw visits stay on the phone. The model uses counts such as hours away from home and distinct places per day. Friends never see location. |
| Movement, sleep, steps | Yes | Read from Core Motion and HealthKit, kept on the phone, never used for ads or shared. |
| App opens and session lengths | Yes, for apps the user picks | Timestamps stay on the phone. The model uses patterns such as late-night scrolling or a jump in opens. App names never leave the phone. |
| Daily screen time | Yes, on the phone only | Apple enforces this. Threshold alerts feed the on-device model only. |
| Incoming message activity | Yes, counts only | Only the time a message arrived is logged. Content and sender are never received. |
| Phone calls | Not in v1 | Too unreliable on iOS to be worth asking for. |
| Message content | Never | Other people in those chats never consented, it is the most sensitive data on a phone, and users who know they are read change how they talk. |
| Who the user talks to | Never | It profiles people who never signed up. |
| Live location shared with friends | Never | Turns a support app into a tracking app. A controlling partner or parent could demand to be in someone's circle. |
| Nudges sent to friends | Yes | Contain only "reach out to this person." No reason, mixed with random cover nudges. |
| Diagnosis or label ("depressed") | Never produced | This is not a clinical tool. |

**Design principles that follow:**

1. **Consent once, clearly.** The signup screen lists every signal in plain language, with a toggle for each, and states that friends may be nudged automatically.
2. **Friends get the ask, not the why.** A nudge carries no location, app, sleep, or message detail.
3. **Cover nudges.** Random nudges on normal days mean a nudge never reveals that someone is struggling.
4. **On-device by default.** Raw signals and the model stay on the phone. The server knows circles and nudge events, nothing else.
5. **Easy off switch.** Pause, revoke, and delete are always one tap away.
6. **Emergencies go to professionals.** Friends are for connection; the crisis path points to 988 and emergency services.
7. **Expect regulation.** Mental-health-adjacent data is regulated in some places (for example, Washington's My Health My Data Act), so collecting less also lowers legal risk if the app ships.

## Open questions

- [ ] **How much setup will users tolerate?** Shortcuts automations unlock app and message signals, but each one is a manual step.
- [ ] **How often should cover nudges go out?** Too few and nudges reveal trouble; too many and friends tune them out.
- [ ] **Does the user see when a nudge went out?** Transparency builds trust, but it may make a friend's message feel less spontaneous.
- [ ] **Is friend feedback after reaching out okay?** It improves the model, but it can feel like reporting on a friend.
- [ ] **iOS only, or Android too?** iOS needs user setup for app and message signals; Android exposes them directly.
- [ ] **How smart is the "AI"?** A rule-based score against a personal baseline is demo-ready; a trained model needs data the team does not have.
- [ ] **How do we demo two weeks of baseline in a weekend?** Likely seeded sample data plus live Shortcuts events.
- [ ] **Who is the first user?** College students on one campus is a natural wedge.

## Decisions

| Date | Decision |
| --- | --- |
| Nov 6, 2026 | Name changed to Sunny Side Up. |
| Nov 6, 2026 | Friends are nudged automatically, with consent given once at signup. The user is not asked each time. |
| Nov 6, 2026 | In-app messaging and a daily mood check-in are dropped as core features. |
| Nov 6, 2026 | Proposed, not yet agreed: message content is never collected. |
