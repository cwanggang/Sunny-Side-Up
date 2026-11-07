# Analytics: Entrinsik Informer (B4.5 / B5.3)

Informer gets **read-only, de-identified numbers only** (plan §9.7). It logs in as the Postgres role
`informer_ro`, which can read the `analytics` schema and nothing else: no names, user ids, media,
message bodies, drift scores or `is_quiet`. Circles appear only as a hashed `circle_key`.

## Part 1: get an Informer account (the website only offers "Request a demo")

Informer is enterprise software. There's no sign-up button: Entrinsik gives you a login to an
Informer site they host (usually a URL like `https://<something>.entrinsik.com`). For a hackathon
that normally comes from Entrinsik as a sponsor.

1. **Ask the organizers / Entrinsik people at the event** (sponsor table, Discord or Slack sponsor
   channel). Message to copy:
   > Hi! Our team (Sunny Side Up) wants to use Informer for our analytics. Could we get a login to a
   > hackathon Informer instance? We need to add our own PostgreSQL datasource (a Supabase database).
2. If nobody at the event can help, use **Request a demo** on entrinsik.com and say it's for the
   hackathon, today, and what you need (above). It may not arrive in time, so do step 1 first.
3. When you get access you should have: **a URL, a username, a password**. Log in once to check.

## Part 2: create the read-only database login (Supabase, 1 minute)

1. Open the Supabase dashboard → project **sunny side up** → **SQL Editor** (left sidebar) →
   **New query**.
2. Paste this, change the password to your own long random one, click **Run**:
   ```sql
   alter role informer_ro with login password 'CHANGE-ME-to-a-long-random-password';
   ```
   "Success. No rows returned" means it worked. Keep the password somewhere safe (not in the repo).

## Part 3: get the connection address (Supabase)

1. In the Supabase dashboard, click **Connect** (top of the page).
2. Choose the **Session pooler** option (not "Direct connection": that one is IPv6-only and
   Informer probably can't reach it).
3. Write down the **host**. It looks like `aws-0-us-east-1.pooler.supabase.com` (yours may differ).

Your connection details:

| Field | Value |
| --- | --- |
| Host | from Part 3 |
| Port | `5432` |
| Database | `postgres` |
| Username | `informer_ro.zztlrcshhvhesnocbhrh` (role + `.` + project ref; the suffix matters) |
| Password | from Part 2 |
| SSL | required / on |

## Part 4: connect Informer to it

Exact menu names vary by Informer version; look for these:

1. Log in to Informer → open **Datasources** (often under the admin/gear menu).
2. **New datasource** (or **Add**) → type **PostgreSQL**.
3. Fill in the table above, turn SSL on, and click **Test** / **Save**.
4. If it asks which schema, choose **analytics**. It's the only one this login can read.

If it fails, copy the exact error message to Developer B (Claude). Common ones:
- *password authentication failed*: the username is missing the `.zztlrcshhvhesnocbhrh` suffix,
  or the password differs from Part 2.
- *timeout / could not connect*: you used the direct connection host; use the session pooler.

## Part 5: the demo dashboard (B5.3)

Make a dataset/report from each view, then a dashboard:

| Chart | View | Settings |
| --- | --- | --- |
| **Engagement over time** (main pitch chart) | `circle_engagement_daily` | line chart, x = `day`, y = `activity_per_member`, one line per `circle_key` |
| **Daily totals** | `daily_totals` | bars or line, x = `day`, y = `sent` and `opens` |
| **Alert** | `circle_engagement_alerts` | table, filtered to `alert = true` ("a circle's engagement dropped ≥ 25%"); add an Informer alert/notification on it if your version supports that |

The demo circle shows a dip over the last 3 days (one friend went quiet), without saying who.
Data is refreshed by the nightly drift job (08:00 UTC) and whenever the demo runs drift + nudge.
Put screenshots for the pitch in `analytics/screenshots/`.

## Views reference (schema `analytics`)

| View | One row per | Columns |
| --- | --- | --- |
| `circle_engagement_daily` | circle per day | `circle_key`, `day`, `members`, `sent`, `received`, `opens`, `activity_per_member` |
| `daily_totals` | day | `day`, `circles`, `member_days`, `sent`, `opens`, `avg_activity_per_member` |
| `circle_engagement_alerts` | circle | `circle_key`, `recent_avg` (last 3 days), `baseline_avg` (14 days before), `drop_pct`, `alert` (drop ≥ 25%) |

`activity_per_member` = messages/reactions/shares sent + half the app opens, per member per day.
