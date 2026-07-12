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
