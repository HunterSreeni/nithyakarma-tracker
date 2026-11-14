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
| Timezone (IANA name, e.g. `Asia/Kolkata`) | Deciding when the user's day starts and ends - reminder windows and streak/day boundaries | Supabase (`profiles.timezone`, `notification_preferences.timezone`) | No | Core function |
| **Analytics events** (event name + numeric/flag props, no PII) | Product analytics (funnel/retention) | **Supabase (first-party, our own DB)** | **No third-party analytics vendor** | On for signed-in users |
| **Product analytics events** (event name + allow-listed props: `day_complete`, `freeze_used`, `overall_streak`, `from`, `referred`; sanitised page URLs; UTM tags) | Marketing funnel (visit -> signup -> first practice -> retention) | **PostHog EU** (processor) | PostHog (service provider) | App: on; site: cookieless page views only |
| **App-instance ID** (PostHog random `distinct_id`, the Supabase user id after sign-in) | Link a visit to the signup for attribution | PostHog EU | PostHog (service provider) | App only |
| **Install referrer** (Android, Play's `referrer` string, utm_* only kept) | Which campaign link led to the install | Device + PostHog EU | PostHog (service provider) | Android, read once |
| **Crash/error reports** | Stability | **Sentry** | Sentry (processor) | Only if a crash occurs |
| **Advertising ID / device identifiers** (Android only) | Serve interstitial ads | Not stored by us - on-device only | **Google AdMob** | Skipped for ad-free users; gated by UMP consent |

## Key privacy stances
- **PostHog (added 2026-11-14, marketing funnel Phase 0a).** EU region, no
  autocapture, no session replay, heatmaps, surveys or flags, no remote scripts.
  Only the allow-listed props above are sent (`lib/posthog.js` `ALLOWED_PROPS`);
  ritual flags (sandhya/rudram/samidha), practice names and gender stay in our
  own DB. URLs are sanitised before send (referral codes and every non-`utm_*`
  query param removed). Test accounts are marked `is_internal` (email never
  sent). Project setting "discard client IP" should be on. The marketing site
  uses a cookieless counter (`site/funnel.js`), not the SDK. Deleting an account
  leaves only a random ID in PostHog; a scheduled PostHog person-deletion job is
  Phase 0b.
- **Analytics is first-party.** Events go to our own `analytics_events` table.
  Props carry only event names + numbers/flags (e.g. `day_complete`,
  `overall_streak`) - never names, email, or practice content. RLS restricts
  inserts to the signed-in user; reads are service-role only.
- **Crash reporting via Sentry** runs with `sendDefaultPii: false` (no IPs,
  request bodies, or user PII) and only activates when `VITE_SENTRY_DSN` is set.
- **Account deletion is real** (`delete_account` removes the auth user; data
  cascades). Analytics rows are de-identified on deletion (`user_id -> null`).
- Leaderboard visibility is user-controllable (opt-out).
- **Timezone is not location.** It is read from the device's OS timezone setting
  via `Intl.DateTimeFormat().resolvedOptions().timeZone` - no location
  permission, no GPS, and no IP geolocation, so nothing here belongs in the
  Play form's Location category. It is needed because a streak day and a
  reminder window are both defined in the user's own local day, not UTC (see
  `utils/timezone.js` and migration 20260810120000).
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
- **PostHog changes (2026-11-14):** under "Data collected" make sure **App
  activity > App interactions** and **Device or other IDs** are ticked, purpose
  **Analytics**, processed ephemerally: no, collection required (no in-app opt-out
  yet), encrypted in transit: yes. PostHog is a service provider processing on
  our behalf, which Play does not count as "sharing".
- Tick **"Contains ads"** in the store listing; content rating questionnaire must
  answer "yes" to ads.
- Provide the hosted Privacy Policy URL: `https://nithyakarma.org/privacy.html`.
