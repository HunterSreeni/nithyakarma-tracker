# Marketing Funnel Plan (AI-automated, policy-compliant)

Status: **draft v2** (rewritten 2026-11-14). **Phase 0a built 2026-11-14** on
`feat/posthog-phase0` (PostHog EU project created by Sreeni the same day). Phase 0b and
later phases not started.

## Why this exists

Nithyakarma is a live test bed for an **AI-automated marketing funnel**. The goal is to test the
funnel *method itself*: can an AI system draft, publish, measure and propose the next experiment with
minimal human effort? The machinery (tracking, publishing pipeline, nudge logic, weekly analysis loop)
should be reusable for Roundwise later.

What does NOT transfer: channels, messaging and audience behaviour. Results here are workflow evidence,
not market evidence for Roundwise.

## Ground rules

- **Automate within platform rules, never around them.** Publishing goes through official APIs on
  accounts we own. No fake personas, no behaviour designed to look human to dodge bot detection, no
  evasion of flags or rate limits. (Meta Inauthentic Behavior policy removes the accounts *and* the
  Pages involved; that would burn the brand.)
- **Human approves every post for the first 30 days**, to calibrate what gets approved and why. After
  that, only content classes that pass the Phase 1 exit threshold auto-publish; everything else stays
  in the weekly approval queue, and any auto-pause needs a human to resume.
- **Religious text is never auto-published.** Verses, translations, Malayalam/Sanskrit devotional copy
  stay in a weekly approval queue forever. AI must never invent or "translate" a verse.
- **One hypothesis per round.** Change one variable, measure, decide.
- **Success = retained practice, not reach.** Views/likes/follows are not success metrics.
- **No spam.** No bulk WhatsApp, no unsolicited posting into communities.
- **Protected logic stays protected.** Nothing here touches streak, punya, tier, freeze or referral
  reward rules in `AGENTS.md`.
- **Supabase work through the Supabase MCP only.**
- **Small numbers (42 users, ~3 signups/month as of 2026-11-14) are directional**, not significant.

## Channels

| Channel | Mode | Why |
|---|---|---|
| Instagram Business account | Automated via Meta Graph API (Content Publishing) | Sanctioned API on an owned account. Cap is 50-100 API posts / 24h (Meta's docs disagree), far above need |
| Facebook Page | Automated via Meta Graph API | Same |
| Reddit | **Human-posted only.** AI drafts, Sreeni posts | Data API needs approval since Nov 2025 (Responsible Builder Policy); most subreddits ban self-promotion |
| WhatsApp Channel | Optional, human-posted | No posting API for Channels |

## Analytics stack

```
site (nithyakarma.org) --UTM--> app (web / Android / Play Install Referrer)
        |                               |
        v                               v
     PostHog  <---- same distinct_id after signup (auth user id) ---->  PostHog
                                        |
                                        v
                 Supabase practice_logs = source of truth for activation/retention
```

- **PostHog** for visits, UTM attribution, funnels and cohorts. Chosen because it sees the anonymous
  pre-signup journey that Supabase cannot, not because of volume (Postgres is nowhere near limits).
  Free tier: 1M events/month, no card (https://posthog.com/pricing, checked 2026-11-14).
- **Supabase `analytics_events`** (exists since 2026-07-12) is kept until PostHog is verified, then
  `track()` is pointed at PostHog. Activation and retention stay computed from `practice_logs`.
- **Test-account filter from day one:** `*@nithyakarma.test` accounts marked as internal in PostHog and
  excluded in SQL. (As of 2026-11-14, 409 of 612 `analytics_events` rows belong to deleted accounts,
  likely e2e runs.)
- **Fix the web-app beacon:** live CSP on app.nithyakarma.org blocks `static.cloudflareinsights.com`.
  Either allow it or drop the Cloudflare beacon from the app once PostHog covers visits.

## Funnel definition

| Stage | Event | Source |
|---|---|---|
| 1. Impression | Post published / reach | Meta Graph API insights |
| 2. Visit | Landing or app page view with UTM | PostHog |
| 3. Install | `app_first_open` (once per install; `existing_user=true` = an update, exclude) + install source | Play Install Referrer -> PostHog. Official counts: Play Console / App Store Connect |
| 4. Signup | Account created, first-touch source attached | PostHog identify + `profiles` |
| 5. Activation | First counting practice log | `practice_logs` |
| 6. Habit / Retained | Active in days 7-13 / 28-34 after signup | `practice_logs` |
| 7a. Share | Share clicked | `share_clicked` |
| 7b. Referral signup | Signup with a referral code | `referred_by` |

North star: **signup -> first practice logged** and **day-28 retention**.

Definitions:
- **Identity:** auth user id is the PostHog `distinct_id` after signup; anonymous visits merge on identify.
- **Source values:** fixed lowercase list (`instagram`, `facebook`, `reddit`, `whatsapp_channel`,
  `referral`, `playstore`, `direct`, `unknown`). `direct` only when a visit had no referrer and no
  UTM; a lost hand-off is `unknown`, so channel comparisons are not inflated.
- **Cohort:** signup week in `profiles.timezone`.
- **Decision rule:** a round runs its window plus 28 days for retention; judged on direction.

## Phases

### Phase 0 - Instrument (week 1-2)

Implementation plan written 2026-11-14 (Codex-reviewed). Phase 0a ships as one PR on
`feat/posthog-phase0` off `main`; Phase 0b is a later PR.

#### Phase 0a - Tracking

1. **PostHog in the app.** `posthog-js` pinned to 1.447.3 (a week old; skip same-day releases).
   Autocapture, session recording, surveys and toolbar off; `capture_pageview` on;
   `person_profiles: 'identified_only'`. `api_host` is a Netlify reverse proxy at
   `app.nithyakarma.org/ingest` -> the PostHog region host, so CSP `connect-src` stays `'self'` and
   ad-blockers do not drop events. Android (no CSP, origin `https://localhost`) uses the absolute URL.
2. **`track()` dual-writes** Supabase `analytics_events` and PostHog until PostHog is verified, then
   PostHog only. PostHog gets an **allow-list of props**: `day_complete`, `freeze_used`,
   `overall_streak`, `from`, `referred`. The ritual flags (`is_sandhya`, `is_sri_rudram`,
   `is_samidhadhanam`) and `gender` are never sent to PostHog.
3. **Pageview sanitising:** a `before_send` hook strips referral codes (`/r/CODE`, `?ref=`) and every
   query param except `utm_*` from URL and referrer properties.
4. **Identity:** `identify(auth user id)` after sign-in, so the anonymous pre-signup journey merges
   (that is how first-touch attribution works). If the device is already identified as a different
   user, `reset()` first. `reset()` on sign-out. `*@nithyakarma.test` accounts get person prop
   `is_internal = true` (email never sent); PostHog's internal/test-user filter excludes them.
5. **Site (nithyakarma.org):** cookieless (memory persistence) PostHog through its own `/ingest`
   proxy. "Open the web app" CTAs carry the visit's UTMs (default `utm_source=site`), preserving
   existing params/fragments without duplicates. The Play link gets `&referrer=<utm string>`,
   URL-encoded exactly once.
6. **Android Install Referrer:** small in-repo Capacitor plugin on Google's official
   `com.android.installreferrer:installreferrer:2.2` (no third-party plugin). Read on first launch,
   persisted so later launches never overwrite it, sent as `$set_once` `initial_utm_*` person props.
   Unavailable or error -> source `unknown`, retried on the next launch until a result is stored.
7. **Cloudflare beacon:** removed from `app/index.html` (live CSP blocks it anyway), along with the
   now-dead `scripts/strip-web-analytics-android.js` and its `capacitor:copy:after` hook. The
   marketing site keeps Cloudflare's edge-injected analytics.
8. **First-touch stays PostHog-only.** No `profiles` column, so no change to the protected
   reward-column grants in `AGENTS.md`.
9. **Data and consent:** PostHog becomes a third-party processor. Update the privacy policy
   (`app/src/components/LegalPages.jsx`, `site/privacy.html`) and `docs/DATA-SAFETY.md`, plus
   Play Data Safety form text for Sreeni to apply in Play Console. Payloads carry event names, source
   and numeric/flag props only: no names, email, practice names/slugs, logs or gotra/family details.
   Public panchangam data used to *generate posts* is not user data and is unaffected.
10. **Verify:**
    - vitest for the prop allow-list, the pageview sanitiser and the UTM/Play link rewriting.
    - CORS check: the Android origin can POST to `/ingest` (preflight + `Access-Control-Allow-Origin`),
      and every SDK endpoint used (`/e`, `/flags`, `/i/v0/e`, static assets if any) is forwarded with
      path, query, method and body intact. Same for the site's `/ingest`.
    - Full gate: lint + vitest + build + Playwright e2e.
    - One live tracked visit -> signup -> first practice visible in PostHog with test accounts excluded.

**As built (2026-11-14), two deliberate deviations from the items above:**
- Android talks to `https://eu.i.posthog.com` directly instead of through the web
  proxy: the WebView has no CSP, and PostHog's CORS was verified to allow the
  Capacitor origin `https://localhost`. Web still uses `/ingest`.
- The marketing site uses a ~100-line cookieless counter (`site/funnel.js`:
  `$pageview` + `cta_clicked`, random id per page view, no person profiles) instead
  of the PostHog SDK, which is ~400 KB for a 5-page static site.
- The app loads the PostHog "slim, no-external" build lazily (about 54 KB gzip,
  outside the startup bundle).
- Added the same day: a `platform` property (`web`/`android`/`ios`) on every event, the
  `app_first_open` install event, and a per-tab `$session_id` on the site counter
  (PostHog Web Analytics needs it for sessions and bounce rate).
- iOS (after Apple approval): no per-user install referrer exists; use App Store
  Connect campaign links (`ct=`) for aggregate source counts.

#### Phase 0b - Signals and cleanup (later PR)

1. In-app signals in place of interviews:
   - one-question "How did you hear about us?" after onboarding
   - one-tap "what stopped you?" prompt shown in-app on return after 7+ inactive days (once per user,
     dismissible, never via push)
2. Scheduled cleanup (edge function on cron) that deletes PostHog persons whose auth user no longer
   exists, so account deletion also removes analytics data. `delete_account` itself is not touched.
3. PostHog funnel + retention dashboards, test accounts excluded. Activation and retention are
   still judged from `practice_logs`.

Exit: funnel visible end to end on at least one tracked visit -> signup -> first practice.

### Phase 1 - Human in the loop (days 1-30 of posting)

- AI pipeline drafts posts for Instagram + Facebook from in-app panchangam/festival data and a brand
  voice guide. Sreeni approves, edits or rejects each one.
- Every decision is logged (approved / edited / rejected + reason). This log is the training signal
  for what can be automated later.
- Fixed posting times; one content type per round.
- Reddit: AI drafts for chosen subreddits that allow it; Sreeni posts manually.

Exit: approval-log review. A content class qualifies for auto-publish only with at least 20 posts
reviewed, at least 90% approved unedited, and zero factual or religious corrections (threshold
adjustable in Open decisions).

### Phase 2 - Automated publishing (from day 31)

- **Auto-publish:** only the approved content classes, e.g. data-driven panchangam/festival cards
  generated deterministically from our own tables.
- **Weekly approval queue:** anything with verses, devotional copy or new formats.
- Auto-pause if the API returns a policy or spam error, engagement drops sharply, or a post is
  removed. A human reviews before resuming.
- Activation nudges: a "signed up, not yet activated" segment in the existing `send-reminders`
  pipeline (opted-in push only, at most one nudge per user, respects notification settings).

### Phase 3 - Weekly AI analyst loop

- Weekly job: pull PostHog + `practice_logs` funnel numbers and Meta insights, write a one-page
  report, propose the next single-variable test. Sreeni accepts or rejects the proposal.
- Referral prompt placement tests at high moments (streak milestone, tier crossing); reward rules
  unchanged.

### Phase 4 - Retro and Roundwise template

- Package: event schema, UTM conventions, publishing pipeline, approval-log criteria, nudge segments,
  weekly report prompt, retro template.
- List what will NOT carry over.

## AI roles

| Role | Output | Human gate |
|---|---|---|
| Content drafter | Instagram/Facebook posts, Reddit drafts | Phase 1: every post. Phase 2: verses/new formats only |
| Publisher | Scheduled posts via Meta Graph API | Auto-pause on policy errors |
| Nudge copywriter | Activation nudge variants | Approve once per variant |
| Weekly analyst | Report + next test proposal | Sreeni decides |

## Open decisions

1. ~~PostHog region~~ - EU, chosen by Sreeni 2026-11-14.
2. First-touch storage: proposed 2026-11-14 as PostHog-only for now (Phase 0a item 8); a `profiles`
   column would need a protected grant change and explicit approval.
3. Posting cadence and the approval-rate threshold for auto-publish.
4. Publishing runtime: Supabase edge function on cron vs GitHub Actions.

## Next step

Approve or edit this plan, then start Phase 0.

Sources: Meta Inauthentic Behavior policy
(https://transparency.meta.com/policies/community-standards/inauthentic-behavior), Instagram content
publishing limit
(https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit),
PostHog pricing (https://posthog.com/pricing).
