# AI-Dev Note: protected app/business logic

Do not change the product rules below - across every section of this file - unless Sreeni explicitly asks for that exact behavior change. Refactors, cleanup, inferred fixes, dependency work, and adjacent features are not authorization to alter them. Any explicitly authorized change must include updated SQL integration assertions, frontend mirror/component tests where they exist, this note, and (for SQL) a migration that preserves clean replay - never edit an already-applied migration to change production behavior (comment-only edits, like the AI-DEV notes themselves, are fine).

## AI-DEV NOTE comment convention

Mark non-obvious code with a comment starting `AI-DEV NOTE:`, right above the line(s) it explains. Add one whenever:

- the logic encodes a business rule that isn't self-evident from reading the code alone (a specific date, a workaround for a named bug, a semantics decision like "any 1 of N completes it")
- the surface is already listed as protected in this file, or becomes protected by the change you're making
- a future edit could plausibly "fix" the behavior back to something that looks more obviously correct but is actually wrong

Keep the note short and state the *reason*, not just the rule - the code already shows the rule. Update an existing note in place when its rule changes rather than stacking a second one beside it. This is the same convention already used throughout `app/src/` and `app/supabase/` (e.g. `app/src/utils/cadence.js`, `app/src/components/TodayPage.jsx`) - keep using it for any new protected or easily-misread logic.

## Streak & freeze

- One local calendar day adds at most one overall streak day. Any one scheduled, `affects_streak=true` practice with a counting log completes that day.
- Any one Sandhyavandhanam slot completes Sandhya and the day; the other slots earn their configured punya but never add the daily or per-practice streak again.
- Yesterday catch-up is Sandhyavandhanam-only, exactly one local day back, forward-looking only, and awards the full configured punya. Its first counting slot completes yesterday; later slots do not double-count it.
- Backfilling yesterday must repair chronological order whether it is marked before or after today. Two consecutive completed days from a fresh streak must display streak 2.
- A freeze is consumed only by a real completion that bridges exactly one missed day. Scheduled decay never spends a freeze. A later yesterday backfill refunds exactly one only when that completion actually spent one.
- Tier crossings top freeze credits up to the tier cap. Referrals add one only up to the same cap. Freeze balances never reset to the cap merely because one was used.
- The full next local day remains a catch-up grace window. Reset happens only after that window closes and produces a durable `streak_reset` event.
- `profiles.timezone`/the parent's timezone defines the server-local day. The database RPC is authoritative; client helpers are display mirrors and must remain aligned with SQL tests.

Protected implementation surfaces:

- `app/supabase/migrations/*submit*`, `*streak*`, and the latest definitions of `submit_practice_log`, `submit_yesterday_sandhya`, `streak_after_completion`, and `decay_stale_streaks`
- `app/supabase/tests/integration-assertions.sql`
- `app/src/utils/streak.js`, `app/src/utils/cadence.js`, `app/src/hooks/useToday.js`, `app/src/hooks/useAuth.jsx`
- the Today-page daily streak card and `YesterdaySandhya` flow
- freeze/streak event notification generation and delivery

## Punya & tiers

- Punya only increases through `submit_practice_log`'s `pr.punya_value` award (see Streak & freeze above) or `apply_referral`'s signup bonus. Never award punya from client code.
- Reward/streak columns (`punya`, `ad_free_until`, `freeze_credits`, streaks, `last_complete_date`, `referred_by`, `referral_code`) on `profiles`/`family_members`/`user_practices` are server-only: `authenticated` has column-level grants for just the fields the app edits (migration `20261109120000_lock_reward_columns.sql`). Never re-grant table-wide INSERT/UPDATE; add a new client-editable column to that allow-list explicitly. `gender` is not client-updatable (it would bypass the eligibility gate).
- Tier thresholds (`tier_for`) are fixed bands: Shishya < 100 <= Sadhaka < 400 <= Yogi < 1000 <= Rishi < 2500 <= Brahmarishi. Freeze cap (`freeze_cap_for`) mirrors the same bands 1..5. Changing one without the other breaks the "tier crossing tops up freeze" rule above.

Protected implementation surfaces: `tier_for` (`app/supabase/migrations/*tier_for*`), `freeze_cap_for` (already covered by the `*streak*` glob above), `app/src/utils/tiers.js`.

## Referrals

- A referral code can only be applied once per referred account (`referred_by` set on first use), never self-referral, and is rate-limited to 5 applications per referrer per rolling 24 hours. `apply_referral` refuses when the caller's `referred_by` is already set (migration `20261109180000_referral_once_per_account.sql`), in addition to the unique `referrals.referred_id`.
- "Once per referred account" relies on `referrals.referred_id` being unique, so the referrals row must survive while the account exists: users cannot delete their own `profiles` row (no DELETE policy or grant, migration `20261109140000_block_profile_self_delete.sql`). Only `delete_account` removes a profile, via the `auth.users` cascade.
- Both sides get the same reward on a successful apply: 30 ad-free days (extending, not replacing, any existing `ad_free_until`) and one freeze credit, capped at the referrer's/referee's own current tier cap via `freeze_cap_for`.

Protected implementation surfaces: `apply_referral`, `get_my_referrals` (`app/supabase/migrations/*referral*`), the `apply_referral` call site in `app/src/hooks/useAuth.jsx`.

## Notifications & reminders

- Push delivery is claim-then-send (`claim_notification_delivery`): a delivery row is inserted as `'sending'` before the provider call, finalized to `'delivered'`/`'failed'` after. A transient provider failure must stay retryable (status `'failed'`, picked up by the next cron tick or a stuck `'sending'` row older than 5 minutes) - never silently dedupe out a real failure.
- Streak/freeze transition pushes (`freeze_used`, `streak_reset`) are event-driven from the durable `streak_events` table, not inferred from current profile state, and fire before the time-window reminder logic on every run.
- The 08:00/20:00 streak nudges gate on the same "any one `affects_streak` practice already logged today" day-completion rule as the streak logic itself (`dayComplete` mirrors `cadence.js`/the SQL bool_or aggregate) - never "every practice logged", or the nudge fires after the day is already secured.
- Freeze-aware nudge wording (`freezeNudge`) only replaces the generic nudge at the exact gaps the freeze mechanic cares about (1-day gap at 20:00, 2-day gap at 08:00) - judged against each user's own local day, never a fixed UTC cron time.
- Sandhya slot reminders are gated to male users with an active (non-archived) Sandhyavandhanam practice; the streak nudge skips users whose practices are all archived, but day completion still counts every row's logs; each slot fires once, never re-sent after that slot is already logged.
- On Android and iOS, reminders come only from the server FCM push. `scheduleAllReminders` asks for permission and cancels leftover local alarms (ids 100-500) but schedules none. Without exact-alarm permission those local alarms were deferred by Android and fired late as duplicates (Nov 2026). iOS joined on 2026-11-22 (Sreeni): `AppDelegate.swift` swaps Apple's APNs token for an FCM token, saved with platform `ios`, and `send-reminders` sends to it with `sendFCM`. Local alarms stay only as the fallback on a native platform with no server push. The 21:30 local "last call" therefore no longer fires on Android or iOS.
- `registerFCM` resolves only after the device token is saved to `push_subscriptions` (or rejects on a registration error, a failed save, or 20 s without a token), so the notification pref never turns on, and the first-run test push never runs, before a row exists. On iOS the token arrives seconds after `register()`; returning early caused "No active notification subscription found" on the first TestFlight build (2026-11-22).
- One push endpoint (device FCM token / browser subscription) belongs to exactly one account - the latest to register it. The `push_subscriptions_single_owner` trigger enforces this server-side; a client-side delete of another account's row is a silent no-op under RLS (that was the duplicate-push-on-shared-phone bug). Sign-out releases only this device's row and cancels local reminders, best-effort and time-capped - never block sign-out on it.

Protected implementation surfaces: `claim_notification_delivery` (`app/supabase/migrations/*notification_deliver*`), `push_subscriptions_single_owner` (`app/supabase/migrations/*push_subscriptions*`), `app/supabase/functions/send-reminders/`, `app/supabase/functions/send-freeze-notifications/`, `app/supabase/functions/_shared/{push,fcmMessage,freezeNudge,streakEventMessage,observanceMatch,dayComplete,reminderWindow,reminderGate}.ts`, `app/src/hooks/useNotifications.js`, `app/src/utils/{notifications,pushAndroid,webPush}.js`, `app/ios/App/App/AppDelegate.swift` (push token handling).

## Sandhya / Samidhadhanam eligibility gating

- `check_sandhya_eligibility` (a DB trigger on `user_practices` insert, and on restore of an archived row via `sandhya_eligibility_on_restore`) is the sole gate: Sandhyavandhanam requires male + (for family members) `upanayanam_done`; Samidhadhanam additionally requires unmarried (self) or upanayanam-done-and-unmarried (family member). These are hard `raise exception` blocks, not soft warnings - client-side checks are a UX convenience only, never the actual gate.

- Removing an anushtanam is a soft archive (`user_practices.archived_at` via `set_practice_archived`), never a hard delete: logs, punya, the overall streak, history and leaderboard scores stay. Re-adding the same practice restores the same row. Sandhyavandhanam is not removable. Streak/punya day-completion logic deliberately ignores `archived_at` (past logs keep counting), but `submit_practice_log` (and so `submit_yesterday_sandhya`) refuses NEW logs on an archived row (migration `20261109160000_reject_logs_on_archived_practice.sql`).

Protected implementation surfaces: `check_sandhya_eligibility` (`app/supabase/migrations/*sandhya_eligibility*`, `*samidhadhanam*`, `*brahmayagnam*`), `set_practice_archived` (`app/supabase/migrations/*archive_user_practices*`).

## Account deletion

- `delete_account` deletes the `auth.users` row directly; every owned row (profile, family members, practice logs, streak events, push subscriptions, referrals, etc.) must cascade via `on delete cascade`, not app-level cleanup. A new table that stores `owner_id`/`user_id` without a cascading FK silently orphans rows here - this has bitten the project before (see `docs/ROADMAP.md`'s temple-visit schema note).

- Sign in with Apple users (iPhone only, native `signInWithIdToken`, no web flow) get their Apple tokens revoked before `delete_account` runs (Apple TN3194, authorized by Sreeni 2026-11-22): the app asks Apple for a fresh authorization code and the `apple-revoke` edge function exchanges it, checks the verified Apple `sub` is the caller's own Apple identity, and revokes. Closing Apple's sheet aborts the deletion. A failed revoke never blocks deletion: the account is still deleted and the login screen tells the user to remove the app in iPhone Settings. `delete_account` itself is unchanged.

Protected implementation surfaces: `delete_account` (`app/supabase/migrations/*delete_account*`), `deleteAccount` and `revokeAppleBeforeDelete` (`app/src/hooks/useAuth.jsx`, `app/src/utils/appleAuth.js`), `app/supabase/functions/apple-revoke/`, `app/supabase/functions/_shared/appleRevoke.ts`.

## Leaderboard / Sabha

- `get_leaderboard` scores are period-scoped (week starts Monday via `date_trunc('week', ...)`, month via `date_trunc('month', ...)`) and scope-gated (`kids` vs. adults are separate pools, never mixed). Sabha participation is opt-in and off by default per account - never flip that default.

Protected implementation surfaces: `get_leaderboard` (`app/supabase/migrations/*leaderboard*`).

## AdMob / ads

- Ad gating (`isTesting`/dev-mode bypass, interstitial frequency, ad-free-until honoring) lives in `app/src/utils/ads.js`. `ad_free_until` from a referral or purchase must always suppress ads client-side - never show an interstitial to a user with a future `ad_free_until`.
- No ad of any kind after marking a practice (Sreeni, 2026-11-18): the Today page never calls `showInterstitial`. The only ad in the app is the opt-in rewarded video for an extra Jadhagam download; `ad_free_until` users never see it (their downloads are free).
- Android and iOS each have their own rewarded unit (`REWARDED_ID`, `REWARDED_ID_IOS`, 2026-11-22). `app_config.admob_rewarded_ad_unit` is a comma-separated list of every rewarded unit, and `admob-ssv` rewards only units on it, so a new unit goes into that list before any build uses it. iOS never shows an App Tracking Transparency prompt.

- The Jadhagam is left out of the iPhone app (`JADHAGAM_ENABLED` in `app/src/utils/features.js`, Sreeni, 2026-11-26) for the first App Store submission (guideline 4.3(b) astrology risk), so iOS currently shows no ads at all. It is a fixed platform check, never a remote switch: bringing it back is a new submitted build that names it in the review notes.

Protected implementation surfaces: `app/src/utils/ads.js`.

## Update prompts

- `public.app_min_versions` (one row per `android`/`ios`) drives two prompts in the native app, compared against the INSTALLED native version (`App.getInfo`), never `package.json`: below `suggested_version` a dismissible Today-page card, below `required_version` a blocking screen shown before anything else, sign-in included. Both default to `0.0.0`; raise them with SQL (service role) only, `required_version` only for a build that truly breaks (a hard update wall is an App Store review risk). Fail open: offline, no row, or a malformed version never blocks. The web app never checks. It is a nudge, not enforcement: old builds can still call the API.
- `release.yml` builds Android and iOS from one resolved commit and refuses to start when `app/package.json` and the Android `versionName` differ.

Protected implementation surfaces: `app/src/utils/appUpdate.js`, `app/src/hooks/useAppUpdate.js`, `app/supabase/migrations/*app_min_versions*`.

## Panchangam / observance calendar

- Observance/tharpanam matching (`bestMatch`/`bestAdvanceMatch` in `observanceMatch.ts`) is priority-then-specificity ordered and category-scoped (`tharpanam` vs. `observance` never cross-match). `day_offset` on a rule means "check the neighboring day's panchangam row, fire on the candidate day" - do not reinterpret it as shifting which day the notification is dated.
- Only rules with `advance_notify = true` are eligible for the "in N days" heads-up push; routine monthly tithis (e.g. plain Amavasya) are deliberately excluded from that path.
- Tamil Nadu vs. Kerala day-1 rules differ (aparahna vs. sunset) - see memory `panchangam-day1-rules`; do not unify them.

Protected implementation surfaces: `app/supabase/migrations/*panchangam_observances*`, `*avani_avittam*`, `app/supabase/functions/_shared/observanceMatch.ts`, `app/src/utils/panchangamScript.js`, and `app/src/lib/jadhagam/panchangam.js` (the Jadhagam's on-device solar month/date mirrors the same Tamil sunset / Kerala aparahna day-1 rules; its tests check every 2026-2027 day against `scripts/panchangam-*.json`).
