# Nithyakarma - Test Results

Companion to `TEST-PLAN.md`. Records live execution outcomes.

## Automated suites (2026-07-12)

| Suite | Scope | Result |
|---|---|---|
| Unit (Vitest) | cadence, tiers, notifications, ads, share, pushAndroid, AuthPage, CelebrationModal, GuidedTour, TodayPage sandhya UX | 63/63 pass |
| a11y (axe-core, jsdom) | AuthPage, Terms, Privacy, GuidedTour | 0 serious/critical |
| Integration (SQL via Supabase MCP, rolled back) | 13 sections incl. sandhya 3-slot RPC, referral, daily_count, sequence cycle, streak continuity+reset, cascade | all pass |
| E2E web (Playwright, live on e2efull) | full journey incl. sandhya 3-slot + tour dismiss | 11/11 pass |
| Android boot smoke (adb) | build -> install -> launch -> web layer boots in Capacitor shell | PASS |

## Day-1 manual walkthrough (2026-07-12)

Driven live on the web app (Playwright, e2efull male account) and the Android
emulator. Screenshots captured for each state (local artifacts).

| # | Flow | Expected | Result |
|---|---|---|---|
| 1 | Login (web) | Google + email, Terms/Privacy links | PASS |
| 2 | Onboarding (male) | name+gender; Sandhyavandhanam auto-added | PASS |
| 3 | Guided tour | 3 steps, sandhya step explains 3 slots, dismissable | PASS |
| 4 | Sandhya 1 slot | "Marked!" (not streak), "1 OF 3", streak 0, ✓Morning | PASS |
| 5 | Sandhya 2 slots | "2 OF 3", still progressing | PASS |
| 6 | Sandhya 3 slots | "1 Day Streak!", "ALL 3 SANDHYAS DONE", ring 1/1, punya 15 | PASS |
| 7 | Add practice (daily_count) | Shiva Panchakshari added, "Mark Done" | PASS |
| 8 | History | today grouped, "Sandhyavandhanam (3/3 sandhyas)" | PASS |
| 9 | Sabha leaderboard | "(You)" row pinned+highlighted, Hall of Week, score 1, tiers | PASS |
| 10 | Profile | punya 15, streak 1/best 1, tier progress to Sadhaka | PASS |
| 11 | Female path (Devika) | switch to female subject; "sandhya" search -> No matches | PASS |
| 12 | Terms page | renders, Effective 11 July 2026 · Sreeniverse, faith-neutral | PASS |
| 13 | Privacy page | renders, accurate data practices (Supabase/FCM/AdMob/WhatsApp) | PASS |
| 14 | Overnight continuity (simulated) | backdated streak 5 completed yesterday -> complete all today -> streak 6 | PASS |
| 15 | Overall-streak gating | day incomplete (Shiva pending) holds overall streak at 5 until all done | PASS (correct) |
| 16 | Android login | native sign-in loads Today with real data (streak 6, 2/2) | PASS |
| 17 | Android push permission | native "Allow notifications?" prompt fires (FCM flow) | PASS |
| 18 | Android guided tour | tour renders natively on mobile | PASS |
| 19 | Android Today render | streak card, sandhya card (✓✓✓, "!"), tab bar | PASS |

### Defects found & fixed
- **Stale web e2e assertion** (`getByText('Sandhyavandhanam', exact)`): broke once
  the info "!" button joined the `.p-name` element; the journey had not been
  re-run since. Fixed to a card locator. (commit 278c2eb)

No functional defects found in the app itself during Day-1.

### Notes on the "2-day" window
- Overnight streak persistence and Day-N -> Day-N+1 continuity were verified by
  (a) the integration RPC assertions and (b) a live simulated backdate on e2efull
  (streak 5 -> 6). A real wall-clock Day-2 spot-check can be scheduled if desired,
  but the streak logic is already proven at both the RPC and UI layers.
- Gap/reset (missed day -> streak resets to 1) is covered by the integration
  assertions.

## Accounts
- e2e (preserved UI account) - untouched during this run.
- integtest (profile-less) - used only for rolled-back SQL assertions.
- e2efull (disposable) - used for the destructive walkthrough; reset after.

## Full suite run (2026-07-23), against production, on main post-PR#79

Web build + Android debug APK, run after fixing the Layout.jsx/CI issues from
PR #79. Reseeded e2efull, e2efemale, referral-throwaway, android-sandhya-throwaway,
android-referral-throwaway via Supabase MCP first.

| Suite | Scope | Result |
|---|---|---|
| Vitest (lint + unit/component) | 45 files, all suites | 287/287 pass, lint clean |
| Production build | `npm run build` | succeeds |
| Playwright e2e, full run (no `--grep-invert`) | all 17 tests across 5 specs | 16/17 pass on first run |
| Playwright e2e, `auth-signout.spec.js` re-run | after the fix below | 1/1 pass |
| Android smoke (`android-smoke.sh`) | build→install→launch, boot screenshot | PASS after 2 script fixes (below) |
| Android sandhya (`android-sandhya.sh`) | login→mark 3 slots | login fixed + verified by hand; slot-marking not completed this session (see below) |

### Bug found + fixed: notification prompt re-shown on every sign-in

`auth-signout.spec.js` failed on the first full run - screenshot showed the
"Notifications enabled! ... Continue" screen instead of the expected Logout
button, signed in as `e2e@nithyakarma.test` (an account that already has a
profile). Root cause and fix: see `TEST-PLAN.md` §3, item 1. Added a
`justOnboarded` flag to `useAuth.jsx` / `App.jsx`'s `Gate()`, replacing the old
session-vs-profile-timing heuristic. Re-ran `auth-signout.spec.js` alone
afterward: PASS. Full Vitest suite (287 tests), lint, and build all still pass.

### Android script fixes (before any device testing was possible)

1. All three `android-*.sh` scripts hardcoded the **pre-rename** package
   `in.co.sreeniverse.nithyakarma`; the app has been `org.nithyakarma.app` since
   2026-07-18. Every script would have failed at launch as written. Fixed.
2. `android-smoke.sh` grepped logcat for Capacitor bridge trace lines that
   `loggingBehavior: 'none'` (a deliberate 2026-07-19 security fix) now
   suppresses - it reported FAIL on a fully working build (confirmed via a
   manual screenshot showing the app rendered correctly). Replaced the
   log-string assertions with a boot screenshot for manual confirmation; PASS.

### Android sandhya/referral: login-flow bug found, not fully re-verified

`android-sandhya.sh`'s scripted login intermittently landed on a **real personal
Google account** (`sreeni4298@gmail.com`, cached on the dev emulator) instead of
the seeded throwaway account. Verified via Supabase MCP on both occurrences that
**no practice logs were written to that account either time** - no real data was
affected. Root cause: tapping the email field brings up the on-screen keyboard,
which scrolls the page up to keep the focused field visible, so the
password-field and Sign In taps (calibrated for the no-keyboard layout) missed
their targets. Confirmed by hand-driving the login with corrected keyboard-shown
coordinates - reached the throwaway account (`Namaskaram, Android`, 0-day streak,
matching the seed) cleanly. Fixed the login-step coordinates in both
`android-sandhya.sh` and `android-referral.sh`. The post-login sequence (OS
notification dialog, driver.js tour, sandhya slot taps / onboarding form) was
**not** re-verified end to end against the fix in this session - stopped after
confirming the root cause and the login fix, since further blind screenshot
round-trips have diminishing returns compared to a quick interactive pass with
eyes on the emulator. `android-referral.sh` was not run live at all this session.

Emulator autofill was temporarily disabled and restored to its original setting
while investigating (ruled out - not the actual cause). Emulator app data was
cleared at the end of the session, left signed out.

## Full re-run after PR #81 merged (2026-07-23, same day, follow-up session)

Local `main` fast-forwarded to the merged fix, full rebuild, full re-run of
everything above plus a live production check via the Electronium MCP browser.

| Suite | Scope | Result |
|---|---|---|
| Vitest (lint + unit/component) | 45 files | 287/287 pass, lint clean |
| Playwright e2e, full run | all 17 tests | 17/17 pass |
| Electronium live check, `https://app.nithyakarma.org` | manual sign-in as `e2e@nithyakarma.test` | landed straight on Today (Logout visible) - the notification-prompt-on-every-login bug fix confirmed live in production, not just in Playwright's environment. Profile page, notification settings, and sign-out all spot-checked and correct. |
| Android smoke | build → install → boot screenshot | PASS, verified visually |
| Android sandhya (`android-sandhya.sh`) | login → tour → mark all 3 slots | **PASS, fully unattended**, DB-verified: streak 1, best 1, punya 15, 3 slots logged against the correct throwaway account |
| Android referral (`android-referral.sh`) | login → onboard → apply referral code | **PASS, fully unattended**, DB-verified: `referrer_id` correctly linked to e2e's account, `ad_free_until` = +30 days |

### The Android login bug needed a second, deeper fix

The first fix (recalibrated coordinates for the keyboard-shown layout) was not
enough - re-running `android-sandhya.sh` unattended landed on
`sreeni4298@gmail.com` (the same real personal Google account as before) a
**third time** this same day, and a fourth time on a subsequent manual retry,
before the real problem was understood: the on-screen keyboard's scroll amount
isn't reproducible run to run (confirmed by watching it stay open after typing
in one attempt and close on its own in another, both starting from an
identical `pm clear`). All four occurrences were checked via Supabase MCP -
no logs were ever written to the real account.

The actual fix: stop tapping screen coordinates for the password field and
Sign In button entirely. After the one unavoidable coordinate tap to focus the
email field, both scripts now use `KEYCODE_TAB` (move focus to the password
field) and `KEYCODE_ENTER` (submit) - DOM focus-order keyboard operations that
don't care where the keyboard has scrolled the page to. This was suggested by
Sreeni mid-session ("use the ad fill method") after watching the coordinate
approach fail twice in a row live.

While re-verifying the rest of the flow, also found and fixed: the
Morning/Noon/Evening sandhya slot row and the "+ Add child" profile-switcher
chip are at different heights on screen, but an earlier version of
`android-sandhya.sh` had them confused - two separate tap-driven runs landed
on `/profile` instead of marking a slot, silently, until checked against an
actual screenshot rather than trusting "no crash occurred." Re-measured and
fixed; both scripts now run correctly unattended, verified twice each (once
by hand, once as a full unattended script run) with matching Supabase MCP
confirmation.

Both Android throwaway accounts (`android-sandhya-throwaway`,
`android-referral-throwaway`) were deleted at the end of the session; emulator
app data cleared, left signed out.
