# Data Safety - what Nithyakarma collects

Reference for the Play Console **Data Safety** form and the Privacy Policy. Keep
this in sync whenever data collection changes.

## Collected

| Data | Purpose | Stored where | Shared with third party? | Optional? |
|------|---------|--------------|--------------------------|-----------|
| Email address | Account / auth | Supabase (our backend) | No | Required for account |
| Display name | Profile, leaderboard | Supabase | No | Required |
| Gender | Determines Sandhyavandhanam eligibility | Supabase | No | Required at onboarding |
| Practice logs, streaks, punya, tier | Core app function | Supabase | No | Core function |
| Family member profiles (name, gender) | Parent tracks kids | Supabase | No | Optional |
| Referral code / graph | Referral rewards | Supabase | No | Optional |
| Push token (FCM / web push) | Reminder notifications | Supabase | Google FCM (delivery only) | Optional (notifications off by default) |
| **Analytics events** (event name + numeric/flag props, no PII) | Product analytics (funnel/retention) | **Supabase (first-party, our own DB)** | **No third-party analytics vendor** | On for signed-in users |
| **Crash/error reports** | Stability | **Sentry** | Sentry (processor) | Only if a crash occurs |
| **Advertising ID / device identifiers** (Android only) | Serve interstitial ads | Not stored by us - on-device only | **Google AdMob** | Skipped for ad-free users; gated by UMP consent |

## Key privacy stances
- **Analytics is first-party.** Events go to our own `analytics_events` table.
  Props carry only event names + numbers/flags (e.g. `day_complete`,
  `overall_streak`) - never names, email, or practice content. RLS restricts
  inserts to the signed-in user; reads are service-role only.
- **Crash reporting via Sentry** runs with `sendDefaultPii: false` (no IPs,
  request bodies, or user PII) and only activates when `VITE_SENTRY_DSN` is set.
- **Account deletion is real** (`delete_account` removes the auth user; data
  cascades). Analytics rows are de-identified on deletion (`user_id -> null`).
- Leaderboard visibility is user-controllable (opt-out).
- **Ads (Android only).** One interstitial per session, G-rated only. AdMob uses
  the device advertising ID; we don't collect or store it. A Google UMP consent
  form is shown where required (EEA/UK) before any ad request (`ads.js`), and no
  ad is shown if the user declines.

## Play Console form implications
- Declare: Personal info (email, name), App activity (analytics), App info and
  performance (crash logs), Device or other IDs (advertising ID via AdMob), plus
  Messages/Device IDs only if push is enabled.
- "Data shared with third parties": Sentry (crash), Google FCM (push delivery),
  Google AdMob (advertising ID, for ads). No analytics data sold or shared.
- Tick **"Contains ads"** in the store listing; content rating questionnaire must
  answer "yes" to ads.
- Provide the hosted Privacy Policy URL: `https://nithyakarma.org/privacy.html`.
