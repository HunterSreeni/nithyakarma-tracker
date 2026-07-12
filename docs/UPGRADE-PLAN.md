# Nithyakarma - Upgrade & Hardening Plan

> Execution plan derived from `docs/DISSECTION.md`. Every work item is written as
> a discrete **Intent** with a **Testing Gate** that must pass before the item is
> considered done. Nothing merges to `main` unless its gate is green in CI.
>
> Phase 2 product ideas (thithi observances, panchangam calendar) continue to
> live in `docs/ROADMAP.md`. This document is the "how we ship it safely" plan.

**Owner:** Sreeni
**Created:** 2026-07-12
**Current version:** `0.0.0` (pre-versioning). First managed version: `0.1.0`.
Play Store launch cuts `1.0.0`.

---

## How to read this plan

Each Intent has:

- **Intent** - what changes and why (the "clear intent").
- **Commit type** - the Conventional Commit prefix to use, which drives the
  automatic SemVer bump (see Release Engineering below).
- **Changes** - the concrete surface touched.
- **Testing Gate** - the specific checks that must pass. An Intent is not "done"
  until its gate is green. The gate is enforced by CI on the PR.

Phases are ordered by launch-criticality. Within a phase, Intents are mostly
independent and can be picked up in any order unless noted.

---

## SemVer, Conventional Commits, and the automatic bump

Versioning is automated with **release-please** (GitHub Actions, PR-based). You
never edit the version by hand. The bump is decided from commit messages since
the last release:

| Commit prefix | Meaning | SemVer bump | Example |
|---|---|---|---|
| `fix:` | Bug fix | **patch** `x.y.Z` | `fix: mark button contrast to pass WCAG AA` |
| `feat:` | New feature | **minor** `x.Y.0` | `feat: streak freeze with earned grace days` |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | Breaking change | **major** `X.0.0` | `feat!: migrate mobile auth to phone OTP` |
| `docs:` `chore:` `test:` `refactor:` `ci:` `style:` | No release | none | `docs: add upgrade plan` |

**How the auto-update works end to end:**

1. You merge PRs to `main` using the prefixes above.
2. release-please accumulates them and opens/updates a single **Release PR**
   ("chore: release 0.2.0") with the computed version + generated `CHANGELOG.md`.
3. Merging that Release PR bumps `app/package.json`, updates the Android
   `versionName`, writes the changelog, tags `app-vX.Y.Z`, and cuts a GitHub
   Release. The `app-` prefix is on the internal git tag only (a release-please
   nested-package requirement for reliable auto-tagging); every **user-facing**
   version stays clean `X.Y.Z` (app Profile, Android `versionName`,
   `package.json`).
4. The app reads its version from `package.json` at build time and shows it on
   the Profile screen (see Intent R3).

Pre-1.0 rule: while still pre-launch, breaking changes stay as `feat:`/`fix:`
(they only move the minor/patch). The jump to `1.0.0` is done deliberately at
Play Store launch with a `Release-As: 1.0.0` commit footer.

---

## Phase R - Release Engineering (do this first)

Everything else depends on the pipeline being in place, because each Intent's
gate is enforced by CI.

### Intent R1 - Rock-solid CI pipeline

- **Intent:** Every PR and every push to `main` runs lint, unit/integration
  tests, a11y checks, and a production build. A red pipeline blocks merge. This
  is the safety net all later Intents lean on.
- **Commit type:** `ci:`
- **Changes:** `.github/workflows/ci.yml` (drop-in below); branch protection on
  `main` requiring the CI checks; `app/` as the working directory.
- **Testing Gate:**
  - `oxlint` passes with zero errors.
  - `vitest run` green (unit + integration + `axe-core` a11y suite).
  - `vite build` succeeds and produces `dist/`.
  - Playwright **non-destructive** e2e specs green in CI (deterministic, no
    shared mutable account). The full destructive journey (`@destructive`,
    account `e2efull`) is a **manual pre-release gate**: re-seed via
    `supabase/tests/seed-e2efull.sql` (Supabase MCP) then run locally. It is
    excluded from CI because `delete_account` removes the auth user, so the
    account self-destructs and cannot be a repeatable CI gate.
  - The CI checks are marked **required** in branch protection.

### Intent R2 - Automated SemVer releases (release-please)

- **Intent:** Version + changelog + git tag + GitHub Release are produced
  automatically from Conventional Commits. No manual version edits ever.
- **Commit type:** `ci:`
- **Changes:** `.github/workflows/release-please.yml`, `release-please-config.json`,
  `.release-please-manifest.json` (all drop-in below). Seed manifest at `0.1.0`.
- **Testing Gate:**
  - A test `feat:` commit produces a Release PR proposing a **minor** bump.
  - A test `fix:` commit produces a Release PR proposing a **patch** bump.
  - Merging the Release PR updates `app/package.json`, `CHANGELOG.md`, and the
    Android `versionName`, and creates tag `vX.Y.Z`.
  - The Release PR itself runs the R1 CI checks (requires the PAT below, not the
    default token).

### Intent R3 - Surface the version in the app

- **Intent:** Users and support can see exactly which build they are on; enables
  a "What's new" habit.
- **Commit type:** `feat:`
- **Changes:** inject `package.json` version via Vite `define`; render it in the
  Profile footer (e.g. "v0.2.0").
- **Testing Gate:**
  - Unit test asserts the injected version string is non-empty and matches
    `package.json`.
  - Component test asserts the Profile footer renders `v<version>`.
  - Manual: version shown matches the installed APK's `versionName`.

### Drop-in files for Phase R

`.release-please-manifest.json` (repo root):

```json
{
  "app": "0.1.0"
}
```

`release-please-config.json` (repo root):

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "include-component-in-tag": true,
  "separate-pull-requests": false,
  "packages": {
    "app": {
      "release-type": "node",
      "component": "app",
      "changelog-path": "CHANGELOG.md",
      "extra-files": [
        { "type": "generic", "path": "android/app/build.gradle" }
      ]
    }
  }
}
```

Then annotate the Android version line in `app/android/app/build.gradle` so
release-please can update it:

```gradle
versionName "0.1.0" // x-release-please-version
```

`.github/workflows/release-please.yml`:

```yaml
name: release-please
on:
  push:
    branches: [main]
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          # Use a fine-grained PAT (secret RELEASE_PLEASE_TOKEN), NOT the default
          # GITHUB_TOKEN. PRs opened by the default token do NOT trigger CI, so
          # the Release PR would merge without its gate ever running.
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
defaults:
  run:
    working-directory: app
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_KEY: ${{ secrets.VITE_SUPABASE_KEY }}
          E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
```

**One manual step (yours, in GitHub):** create a fine-grained PAT with
`contents: write` + `pull-requests: write` on this repo and save it as the
`RELEASE_PLEASE_TOKEN` secret; add the Supabase + e2e secrets used by the e2e
job. Then enable branch protection on `main` requiring the `verify` (and `e2e`)
checks.

---

## Phase 0 - Launch blockers (target release: 1.0.0)

No Play Store upload until every Intent here is done and its gate is green.

### Intent 0.1 - Real launcher and adaptive icon

- **Intent:** Replace the default Capacitor blue-X icon with the diya brand mark
  so the home-screen icon and store listing look finished and trustworthy.
- **Commit type:** `feat:`
- **Changes:** all `mipmap-*` densities (`ic_launcher`, `ic_launcher_round`,
  `ic_launcher_foreground`), adaptive `ic_launcher_background` set to a saffron
  tone, `favicon.svg` alignment.
- **Testing Gate:**
  - Visual check on a device/emulator at every density: no blue X anywhere.
  - Adaptive icon renders correctly under circle, squircle, and rounded-square
    masks (Android icon preview).
  - `vite build` + `npx cap sync android` succeed; debug APK installs and shows
    the new icon.

### Intent 0.2 - Production AdMob configuration

- **Intent:** Swap Google's test AdMob IDs for a real account's app ID and
  interstitial unit, and turn off testing flags, so ads actually earn and the app
  is not policy-violating.
- **Commit type:** `fix:` (current state is effectively broken monetization)
- **Changes:** real `APPLICATION_ID` in `AndroidManifest.xml`; real
  `INTERSTITIAL_ID` in `utils/ads.js`; remove `isTesting` /
  `initializeForTesting` for production builds (keep a debug switch).
- **Testing Gate:**
  - `utils/__tests__/ads.test.js` extended: no test-ID constant ships in a
    production build; `isAdFree` still suppresses ads; ad only fires after a
    verified save.
  - Manual on a real device with a real (test-mode) AdMob account: interstitial
    shows after submit, and never before a verified save.
  - Confirm the ad-free referral reward suppresses the real interstitial.

### Intent 0.3 - Password reset / recovery

- **Intent:** Give email users a recovery path so a forgotten password is not a
  dead account, especially on Android where email is the only auth.
- **Commit type:** `feat:`
- **Changes:** "Forgot password?" link on `AuthPage`; Supabase
  `resetPasswordForEmail` flow; a reset-handling route.
- **Testing Gate:**
  - Component test: link visible in login mode; submitting triggers the reset
    call and shows the confirmation notice.
  - e2e: request reset for the `e2e@nithyakarma.test` account and assert the
    "email sent" state.
  - Manual: complete a real reset round-trip on web and Android.

### Intent 0.4 - Accessibility pass (contrast + type scale)

- **Intent:** Fix the failing contrast and tiny fonts so the older target
  audience can actually read and tap the app.
- **Commit type:** `fix:`
- **Changes:** darken primary button surface / adjust text color to reach >=4.5:1;
  darken muted meta text; raise base font sizes; honor OS Dynamic Type.
- **Testing Gate:**
  - `axe-core` a11y suite extended with color-contrast assertions on the primary
    button and meta text; must pass.
  - Automated contrast check confirms button and meta text >=4.5:1 (large text
    >=3:1).
  - Manual: readable at 200% OS font size without clipping.

### Intent 0.5 - Store readiness assets and compliance

- **Intent:** Everything Google requires to approve and rank the listing.
- **Commit type:** `docs:` / `chore:` (no app code, no release bump)
- **Changes:** feature graphic (1024x500), phone screenshots, short + full
  description, a **hosted** Privacy Policy URL, Data Safety form answers, content
  rating, release signing keystore, verified `applicationId`.
- **Testing Gate:**
  - Play Console pre-launch report passes with no policy violations.
  - Data Safety answers reconciled against actual data collected (auth email,
    referral, leaderboard visibility).
  - Signed release AAB installs and launches on a clean device.

### Intent 0.6 - Onboarding value-prop screen

- **Intent:** Show why before asking for gender, so first-run activation does not
  drop at a cold form.
- **Commit type:** `feat:`
- **Changes:** a one-screen intro (what the app does, the Sabha, streaks) before
  the `Onboarding` form.
- **Testing Gate:**
  - Component test: intro renders, "Begin" advances to the form, referral code
    from `/r/:code` still flows through.
  - e2e: fresh signup reaches Today with a tracked practice.

---

## Phase 1 - Retention and growth (target: 1.1.0 - 1.4.0)

### Intent 1.1 - Streak freeze (tied to tier + referrals)

- **Intent:** Stop a single missed day from resetting a long streak to 0 (the
  biggest churn risk for a daily-obligation app), and make freezes a
  **progression reward** so climbing tiers and inviting others feels earned -
  the more you level up, the more grace you get. This matches the audience's
  psychology (reward scales with devotion/rank).
- **Commit type:** `feat:`
- **Economy:**
  - `freeze_credits` on `profiles` and `family_members`, **auto-consumed** on a
    single missed day. Gaps of 2+ missed days still reset (one freeze = one day).
  - **Cap scales with tier:** Jijnasu 1, Sadhaka 2, Tapasvi 3, Rishi 4,
    Brahmarishi 5 (`freeze_cap_for(punya)`).
  - **Levelling up tops credits up** to the new cap.
  - **Each successful referral grants +1 credit.**
  - Kids' profiles earn tier-based freezes too (they have punya); referrals are
    parent-account only.
- **Changes:** one Supabase migration (new columns + `freeze_cap_for` + updated
  `submit_practice_log` streak/consume/top-up logic + referral-grant hook);
  freeze count on the Today streak card; "a freeze saved your streak 🧊" message
  in `CelebrationModal` (driven by a `freeze_used` flag in the RPC response).
- **Testing Gate:**
  - SQL state-machine assertions in `supabase/tests/integration-assertions.sql`:
    consecutive day `+1`; 1-day gap **with** credit continues **and** decrements;
    1-day gap **without** credit resets; 2-day gap resets; tier-up tops up
    credits; referral grants `+1`.
  - Component tests: Today card renders the freeze count; `CelebrationModal`
    shows the freeze message when `freeze_used`.
  - e2e + CI green; manual check of a simulated missed-day-with-credit.

### Intent 1.2 - Streak-miss reminder notification (hardcoded)

- **Intent:** Nudge a user who has not marked anything by a fixed time so they do
  not silently lose a streak. Push notifications stay **hardcoded** for now (no
  scheduling-settings UI); this adds exactly one more notification: a once-a-day
  streak-miss reminder. The broader location/time-aware reminder overhaul is
  deferred to Phase 2 (Intent 2.4) after Phase A live feedback.
- **Commit type:** `feat:`
- **Changes:** one additional hardcoded daily notification (fires once per day
  when the day is not yet complete / streak at risk) in the existing notification
  path (`utils/notifications.js` / `hooks/useNotifications` / the reminders edge
  function). No new settings surface.
- **Testing Gate:**
  - Unit test: the streak-miss notification is scheduled once per day and is
    suppressed once the day is already complete.
  - `hooks/__tests__/useNotifications` / `utils/__tests__/notifications` extended
    to cover the new reminder.
  - Manual on-device: the reminder arrives when the day is incomplete and does
    not arrive after the day is completed.

### Intent 1.3 - Analytics and crash reporting

- **Intent:** Make retention, funnel, and crashes observable so later decisions
  are data-driven, not guesses.
- **Commit type:** `feat:`
- **Changes:** privacy-respecting analytics + crash reporting (events for
  signup, first mark, streak milestone, share, ad-shown); Data Safety updated.
- **Testing Gate:**
  - Unit test: key events fire with expected payloads; no PII in payloads.
  - Verify events land in the analytics dashboard from a debug build.
  - Data Safety form re-reconciled to include analytics.

### Intent 1.4 - In-app review prompt

- **Intent:** Convert happy moments (streak milestones) into store ratings to lift
  ranking.
- **Commit type:** `feat:`
- **Changes:** trigger the native in-app review flow after a milestone, rate-
  limited and never blocking.
- **Testing Gate:**
  - Unit test: prompt requested only at milestones and respects the rate limit.
  - Manual: native review sheet appears on a real device.

### Intent 1.5 - Female activation default

- **Intent:** Give female users (and non-upanayanam profiles) a meaningful Today
  screen instead of an empty one.
- **Commit type:** `feat:`
- **Changes:** a suggested/default parayanam for profiles without
  Sandhyavandhanam; gentle nudge to add one.
- **Testing Gate:**
  - Component test: a female profile sees a non-empty Today with a suggested
    practice.
  - e2e: female signup reaches an actionable Today screen.

### Intent 1.6 - Finish or hide the Friends tab

- **Intent:** Either ship an add-friend flow or hide the dead Friends tab so no
  user hits an empty, confusing screen.
- **Commit type:** `feat:` (add-friend) or `fix:` (hide)
- **Changes:** add-friend by referral/link + `get_leaderboard` friends scope; or
  remove the tab until built.
- **Testing Gate:**
  - If built: unit/integration for the friend relationship + friends leaderboard;
    e2e adding a friend and seeing them ranked.
  - If hidden: `SabhaPage` test asserts the Friends tab is not rendered.

---

## Phase 2 - Depth and premium (target: 1.5.0+)

### Intent 2.1 - Bundled stotram content: karaoke lyrics + audio/video (premium)

> Much later - only after Phase A live feedback. This is the paid upgrade.

- **Intent:** Turn the pure tracker into a place users also practice from -
  **karaoke-style synced lyrics** with **audio/video** for tracked stotrams -
  the strongest stickiness and the core premium lever. Applies to all practices
  **except Sandhyavandhanam** (never audio/video for sandhya).
- **Commit type:** `feat:`
- **Changes:** content model + synced-lyrics/AV player; romanized text (never
  Devanagari, per app convention); **premium "upgrade by tier"** gating.
- **Monetization tie-in:** referral **discounts on the tier upgrade** (see the
  reward ladder, Intent 2.5) - invites lower the upgrade price. Design this once
  we introduce the paid upgrade.
- **Testing Gate:**
  - Unit: content loads per practice; Sandhyavandhanam is excluded from AV;
    premium gate blocks/allows correctly.
  - Component: lyrics sync + audio/video controls work.
  - Manual: playback clean on web and Android; discount math correct.

### Intent 2.5 - Tier + referral reward ladder (perks)

> Post-Phase-A. Tune the ladder to real behaviour before building it.

- **Intent:** Escalating perks as users climb tiers and refer others, beyond the
  Intent 1.1 freezes - the reward grows with rank. Example ladder: each tier adds
  freezes (built in 1.1) **plus** ad-free days (e.g., Sadhaka = 1 ad-free day,
  higher tiers = more), and later, upgrade discounts. Referrals grant freezes now
  and, once the paid upgrade exists (2.1), **referral discounts** on it.
- **Commit type:** `feat:`
- **Changes:** a declarative tier/referral -> perks table driving grants
  (ad-free days, discounts); surfaced on Profile.
- **Testing Gate:**
  - Unit: each tier/referral event grants exactly the configured perks (no
    double-grant); caps respected.
  - Manual: perks visible and applied after a tier-up / referral.

### Intent 2.2 - Rewarding celebration (sound / haptic / motion)

- **Intent:** Make the mark-done moment feel rewarding, the dopamine loop the
  static emoji currently misses.
- **Commit type:** `feat:`
- **Changes:** animation + optional sound + haptic on `CelebrationModal`, honoring
  reduced-motion and mute settings.
- **Testing Gate:**
  - `CelebrationModal` test: still fires only from a verified save; respects
    reduced-motion.
  - Manual: haptic/sound on device, silent on web, no jank.

### Intent 2.3 - Palette coherence pass

- **Intent:** Resolve the black/green intrusions so the chrome reads sacred, not
  fintech.
- **Commit type:** `fix:`
- **Changes:** topbar from `#0d0d0d` toward deep maroon/espresso; referral card to
  saffron/gold; green reserved for the WhatsApp button.
- **Testing Gate:**
  - a11y suite re-run: new chrome colors still pass contrast.
  - Visual review across Today, Sabha, Profile, Auth in light/dark.

---

### Intent 2.4 - Sandhya-time-aware reminders + panchangam (post-Phase-A)

- **Intent:** Deferred until after Phase A live feedback. Replace the hardcoded
  reminders (including the Intent 1.2 streak-miss nudge) with real
  morning/noon/evening, sunrise/location-based scheduling, landing alongside the
  panchangam / thithi calendar work in `docs/ROADMAP.md`. Scope will be refined
  from what live users actually ask for.
- **Commit type:** `feat:`
- **Changes:** location/sunrise-based slot scheduling; a reminder-settings
  surface in `NotificationSettings`; integration with the panchangam/thithi
  scheduling from the roadmap.
- **Testing Gate:**
  - Unit tests for slot-time computation across timezones and DST.
  - `hooks/__tests__/useNotifications` extended for three-slot scheduling.
  - Manual on-device: notifications arrive in the correct windows.

---

## Global Definition of Done (applies to every Intent)

1. Code + tests written; the Intent's specific Testing Gate is green locally.
2. Conventional-commit message with the correct prefix (drives the SemVer bump).
3. PR opened; the R1 CI pipeline (lint, test, build, e2e) is green.
4. Required checks satisfied under branch protection; PR merged to `main`.
5. release-please rolls the change into the next Release PR; merging it cuts the
   version, changelog, tag, and GitHub Release automatically.
