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

### Intent R4 - Commit reconstructed migrations, close schema drift (B2)

- **Intent:** Close B2 - the Learning tab, panchangam info box, and their
  backing tables were live in prod with no matching committed migration, so a
  clean rebuild from the repo would have produced a different database. The
  DDL has since been reconstructed and applied (`learning_content`,
  `panchangam_days`, `panchangam_service_role_grant`,
  `drop_learning_content_list_policy` - confirmed present in
  `mcp__supabase__list_migrations` against project `fkrifejzhnhknkuyhjhp` as of
  2026-07-17), but the files are still untracked locally, not committed to git.
- **Commit type:** `fix:` (repo now matches deployed state; no DB change,
  since these are already applied live).
- **Changes:** commit the four reconstruction migrations to git.
- **Testing Gate:**
  - `mcp__supabase__list_migrations` output and the committed
    `app/supabase/migrations/*.sql` filenames match 1:1 - nothing applied
    remotely that isn't in git, and vice versa.
  - A fresh local Supabase stack replaying every committed migration in order
    produces the Learning + panchangam tables with no manual patching.
  - This drift check (`list_migrations` vs. `ls migrations/`) is added as a
    manual pre-release step (Phase 0 launch checklist) so it doesn't silently
    reopen.

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

No Play Store upload until every Intent here is done and its gate is green. At
launch, the manual `Release-As: 1.0.0` commit footer promotes the version to
`1.0.0` (tag `app-v1.0.0`).

**Recommended execution order** (code-only first for momentum, then the items
that need your external inputs): 0.4 accessibility -> 0.3 password reset -> 0.6
onboarding value-prop -> 0.7 password policy -> 0.1 icon -> 0.2 AdMob -> 0.5
store assets.

**What I need from you** (external, can't be produced in-repo):
- **0.2 AdMob:** a real AdMob account, app ID, and interstitial unit ID.
- **0.5 store:** the release signing keystore (you generate + keep secret), and
  a decision on where the Privacy Policy is hosted (e.g. Netlify).
- **0.1 icon:** approval of the diya mark I generate (or supply your own art).
Everything else I can build and test end to end.

**Standard full-round gate** (applies to every code Intent below, in addition to
its specifics): `lint` clean; `vitest` green; `npm run build` succeeds; web
Playwright e2e 14/14; Android debug APK rebuilt, installed, and the change
verified on the emulator; ships through CI (verify + e2e) and auto-tags.

### Intent 0.4 - Accessibility pass (contrast + type scale)

- **Intent:** Fix the failing contrast and tiny fonts so the older target
  audience can actually read and tap the app. (Measured: white-on-`#F37C02`
  button ~2.7:1 and muted meta `#a89a85` ~2.75:1 both fail WCAG AA.)
- **Commit type:** `fix:` -> patch bump.
- **Changes:** darken the primary action color and/or text to reach >=4.5:1;
  darken muted meta text; raise base font sizes (meta up from ~0.7rem); ensure
  layouts survive OS Dynamic Type / large font scale.
- **Testing Gate:**
  - Extend the `axe-core` a11y suite with color-contrast assertions on the
    primary button and meta text - must pass with zero violations.
  - A unit contrast check asserts button + meta text >=4.5:1 (>=3:1 for large).
  - **Android device:** readable at 200% OS font size with no clipping or
    overlap on Today, Sabha, Profile, Auth.

### Intent 0.3 - Password reset / recovery

- **Intent:** Give email users a recovery path so a forgotten password is not a
  dead account (Android has email-only auth).
- **Commit type:** `feat:` -> minor bump.
- **Changes:** "Forgot password?" link on `AuthPage`; `supabase.auth
  .resetPasswordForEmail` flow; a `/reset` route that sets the new password from
  the recovery link.
- **Dependency:** add the reset redirect URL to the Supabase Auth allow-list
  (via Supabase MCP / dashboard).
- **Testing Gate:**
  - Component test: link visible only in login mode; submit triggers the reset
    call and shows the confirmation notice; `/reset` renders the set-password form.
  - e2e: request a reset for `e2e@nithyakarma.test` and assert the "email sent"
    state (no inbox dependency).
  - **Manual round-trip on web and Android:** real recovery email -> set new
    password -> sign in.

### Intent 0.6 - Onboarding value-prop screen

- **Intent:** Show *why* before asking for gender, so first-run activation
  doesn't drop at a cold form.
- **Commit type:** `feat:` -> minor bump.
- **Changes:** a one-screen intro (track daily anushtanams, streaks + freezes,
  the Sabha) before the `Onboarding` form; "Begin" advances to the form.
- **Testing Gate:**
  - Component test: intro renders; advancing reaches the form; the `/r/:code`
    referral code still flows through to `createProfile`; `onboarding_complete`
    analytics still fires once.
  - e2e: fresh signup passes intro -> form -> reaches an actionable Today.
  - **Android device:** fresh signup shows the intro then the form.

### Intent 0.1 - Real launcher and adaptive icon

- **Intent:** Replace the default Capacitor blue-X placeholder with the diya
  brand mark so the home-screen icon and store listing look finished.
- **Commit type:** `feat:` -> minor bump.
- **Changes:** all `mipmap-*` densities (`ic_launcher`, `ic_launcher_round`,
  `ic_launcher_foreground`), adaptive `ic_launcher_background` (saffron), the
  512x512 Play Store icon, and `favicon.svg` alignment.
- **Dependency:** your approval of the generated diya mark (or supply art).
- **Testing Gate:**
  - **Android device:** launcher icon shows the diya at every density - no blue
    X anywhere on the home screen or app drawer.
  - Adaptive icon renders correctly under circle, squircle, and rounded-square
    masks (Android Studio icon preview or on-device launcher shapes).
  - `npm run build` + `npx cap sync android` succeed; debug APK installs and
    displays the new icon.

### Intent 0.2 - Production AdMob (launch: light, respectful ads)

- **Intent:** Ship real ads at launch, but **light and respectful** - the
  celebration is the reward *after* the ad, ads are **capped** (not every tap),
  and content is **strictly filtered**. Heavy ad friction + the paid escape come
  later (Intent 2.6), so launch never traps users behind ads with no way out.
- **Commit type:** `feat:` (ad UX) then `fix:` (real IDs) -> minor/patch.
- **Dependency (you):** real AdMob app ID + interstitial unit ID (build-time
  config, never committed).
- **Changes:**
  - **Reorder (code, doable now):** fire the interstitial after a *verified
    save*, **before** the celebration - move it out of `CelebrationModal`'s close
    into `TodayPage.mark`; the Intent 1.4 milestone-review branch moves with it.
    Hard rule unchanged: **never on a failed save**. The celebration becomes the
    payoff after the ad, not a dead-end the ad tacks onto.
  - **Frequency cap (code, "lighter"):** at most one interstitial per app session
    (and/or only when a day completes) - **not** on every mark. Tune later from
    the `ad_shown` + retention data.
  - **Content filtering (MANDATORY):** max ad content rating = **G**; block
    sensitive categories (gambling, dating, alcohol, etc.) via the AdMob console +
    SDK request config. A gambling/dating ad beside Periyava during Sandhyavandhanam
    would be a brand disaster - this protects the sacred positioning.
  - **Real IDs (needs you):** real `APPLICATION_ID` (`AndroidManifest.xml`) +
    `INTERSTITIAL_ID` (`utils/ads.js`); drop `isTesting` / `initializeForTesting`
    in prod (keep a debug switch).
- **Testing Gate:**
  - `utils/__tests__/ads.test.js` extended: no Google test-ID in a prod build;
    ad only after a verified save; **frequency cap respected** (not fired again
    within the cap window); `isAdFree` (referral / future subscription) suppresses.
  - **Android device:** ad fires *before* the celebration, once per cap window,
    never on a failed save; the G content-rating filter is set in the AdMob console.
  - Web unchanged (native-only).

### Intent 0.5 - Store readiness assets and compliance

- **Intent:** Everything Google requires to approve and rank the listing.
- **Commit type:** `docs:` / `chore:` -> no release bump (assets/config, not app
  code).
- **Changes:** feature graphic (1024x500), phone screenshots (captured from the
  polished build), short + full description (drafted in-repo), a **hosted**
  Privacy Policy URL - **done**, `AuthPage`'s in-app `/privacy` route is live at
  `https://nithykarma.netlify.app/privacy` (confirmed 200) - Data Safety answers
  (from `docs/DATA-SAFETY.md`), content rating, release signing keystore,
  verified `applicationId` (`in.co.sreeniverse.nithyakarma`), and an
  incrementing `versionCode` strategy.
- **Testing Gate:**
  - Signed release AAB builds, installs, and launches on a clean device/emulator.
  - Play Console pre-launch report passes with no policy violations.
  - Data Safety answers reconciled line-by-line against `docs/DATA-SAFETY.md`
    (email, analytics = first-party, crash = Sentry, push = FCM).
  - `versionCode` increments on each upload (Play rejects duplicates).

### Intent 0.7 - Harden Auth password policy (close S6)

- **Intent:** Close the live Supabase Auth security advisory - HIBP
  leaked-password protection is disabled and min password length is 6, flagged
  in the 2026-07-16 project analysis and confirmed still open via
  `get_advisors` on 2026-07-17. Weak default password rules are a launch
  blocker on an app with no other MFA.
- **Commit type:** `fix:` for the client-side min-length bump; the Auth toggle
  itself is dashboard config, not app code.
- **Dependency (you):** Supabase Dashboard -> Authentication -> Providers ->
  Email: enable "Leaked password protection" (HIBP) and raise min password
  length to 8. No MCP tool exposes this setting.
- **Changes:** raise `minLength` on `AuthPage.jsx`'s password input from `6` to
  `8` to match; update the signup validation copy if it references the old
  minimum.
- **Testing Gate:**
  - `mcp__supabase__get_advisors` (security) no longer returns
    `auth_leaked_password_protection`.
  - Component test: `AuthPage` rejects a password under 8 chars client-side.
  - Manual: signing up with a password on the HIBP breach list is rejected by
    Supabase Auth itself (not just the client-side length check).

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
  - **Cap scales with tier:** Shishya 1, Sadhaka 2, Yogi 3, Rishi 4,
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

### Intent 1.2 - Streak-miss reminder notification (hardcoded) - done

- **Intent:** Nudge a user who has not marked anything by a fixed time so they do
  not silently lose a streak. Push notifications stay **hardcoded** for now (no
  scheduling-settings UI); this adds exactly one more notification: a once-a-day
  streak-miss reminder. The broader location/time-aware reminder overhaul is
  deferred to Phase 2 (Intent 2.4) after Phase A live feedback.
- **Commit type:** `feat:`
- **Status:** the server-side push half was already shipped (ported from the
  predecessor app) - `send-reminders`'s `nudge`/`nudge_morning` slots, which
  check `practice_logs` and skip sending once the day is complete. The gap was
  the **local on-device notification** (`utils/notifications.js`'s NUDGE/
  LAST_CALL), which fired blindly regardless of completion. Fixed:
  `suppressTodayNudgesIfScheduled()` cancels + reschedules both for tomorrow
  (same time-of-day) once `submit_practice_log` reports `day_complete: true` -
  called from the single shared `useToday.js` `submit()` path, so both
  `TodayPage` and the Learning page get it for free.
- **Testing Gate:**
  - Unit test: the streak-miss notification is scheduled once per day and is
    suppressed once the day is already complete. ✅
  - `hooks/__tests__/useNotifications` / `utils/__tests__/notifications` extended
    to cover the new reminder. ✅ (`utils/__tests__/notifications.test.js`,
    `hooks/__tests__/useToday.test.js`)
  - Manual on-device: the reminder arrives when the day is incomplete and does
    not arrive after the day is completed. - pending a real-device check.

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

### Intent 1.5a - Decide the women's flagship-practice scope

> **Decided 2026-07-17: narrow scope.** Intent 1.5 builds the suggested/
> default parayanam nudge as originally scoped - not the flagship parallel
> practice. The flagship idea stays parked; revisit as its own Intent
> (sized like 2.1/2.1a) if later data shows the nudge isn't enough to
> activate female users.
>
> Decision gate, not a build - resolve before starting Intent 1.5 or any wider
> female-activation work. Raised 2026-07-15 as an unscoped product gap: men get
> Sandhyavandhanam as a daily spine; no equivalent flagship practice exists for
> women, capping engagement for roughly half the potential audience.

- **Intent:** Decide, explicitly, which of two scopes Intent 1.5 (and anything
  larger) builds toward:
  1. **Narrow (current 1.5 scope):** a suggested/default parayanam nudge for
     profiles without Sandhyavandhanam - smaller lift, ships faster, but stays
     a nudge toward an existing practice, not a parallel anchor.
  2. **Flagship:** a real daily practice designed as a parallel to
     Sandhyavandhanam for women - own identity, own tracking cadence, own
     tier/streak weight - a materially larger scope (content research,
     practice definition, likely its own UI, probably Phase-2-sized).
- **Commit type:** `docs:` - no release bump; this is a decision recorded in
  this plan, not code.
- **Inputs needed (yours):** which practice(s) would actually anchor this for
  the target household (consult the same tradition sources the app already
  leans on); whether it's scoped for Phase 1 (soon) or deferred to Phase 2
  alongside the premium content work (Intent 2.1).
- **Testing Gate (decision, not code):**
  - A scope decision recorded here (narrow vs. flagship) with the chosen
    practice(s) named, before Intent 1.5 is started.
  - Intent 1.5's open-question note below is resolved/removed to reflect
    whichever scope was chosen.
  - If flagship is chosen, a new Intent (sized like 2.1/2.1a) is written before
    any building starts - this Intent alone does not authorize building the
    larger scope.

### Intent 1.5 - Female activation default

- **Intent:** Give female users (and non-upanayanam profiles) a meaningful Today
  screen instead of an empty one.
- **Commit type:** `feat:`
- **Changes:** a suggested/default parayanam (`SuggestedPractices` in
  `TodayPage.jsx` - Narayaneeyam, Lalitha Sahasranamam, Devi Mahatmyam - chosen
  2026-07-17 to skew toward practices more relevant to the target female
  audience) for profiles without Sandhyavandhanam; gentle nudge to add one.
  **Already built and shipped** (pre-existing in `main` as of this Intent's
  writing; content list tuned 2026-07-17).
- **Scope:** resolved by Intent 1.5a (2026-07-17) - narrow. Builds as
  originally scoped, a suggestion, not the flagship parallel practice.
- **Testing Gate:**
  - Component test: a female profile sees a non-empty Today with a suggested
    practice. **Done** - `TodayPage.test.jsx` "empty-day activation
    (female / non-sandhya)".
  - e2e: female signup reaches an actionable Today screen. **Done** -
    `e2e/journey-female.spec.js` (`@destructive`, mirrors `journey.spec.js`
    against a dedicated `e2efemale@nithyakarma.test` account; re-seed via
    `supabase/tests/seed-e2efemale.sql` through the Supabase MCP before each
    run, per Intent R1's manual pre-release gate pattern).

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

### Intent 1.7 - Native Google Sign-In deep link

- **Intent:** Make "Continue with Google" work on Android, not just web -
  it's currently hidden on native (`AuthPage.jsx`) because the OAuth redirect
  has nowhere to land, not because it's broken.
- **Commit type:** `feat:`
- **Dependency (you):** a Google Cloud OAuth client registered for the Android
  `applicationId` (`in.co.sreeniverse.nithyakarma`) + release/debug SHA-1
  fingerprints; add the resulting redirect URL to the Supabase Auth allow-list.
- **Changes:** a custom URL scheme (or App Link) intent-filter in
  `AndroidManifest.xml`; an `App.addListener('appUrlOpen', ...)` handler (via
  the already-installed `@capacitor/app`) in `useAuth.jsx` that captures the
  redirect and completes the Supabase session; point `redirectTo`
  (`useAuth.jsx`'s `signInGoogle`) at the native scheme when
  `Capacitor.isNativePlatform()`; remove the native-hiding guard in
  `AuthPage.jsx`.
- **Testing Gate:**
  - Unit: `redirectTo` resolves to the native scheme on native, web origin on
    web.
  - Component: Google button renders on native once wired (`AuthPage.test.jsx`
    updated for the new behavior).
  - **Manual on Android device:** tap "Continue with Google" -> completes
    OAuth -> lands back in the app signed in.

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
- **Delivery surface:** the **Learning** nav page (see Intent 2.1a, its first
  concrete build-out) - lets users browse and learn content independent of
  daily tracking, not just an in-practice panel.
- **Monetization tie-in:** referral **discounts on the tier upgrade** (see the
  reward ladder, Intent 2.5) - invites lower the upgrade price. Design this once
  we introduce the paid upgrade.
- **Testing Gate:**
  - Unit: content loads per practice; Sandhyavandhanam is excluded from AV;
    premium gate blocks/allows correctly.
  - Component: lyrics sync + audio/video controls work.
  - Manual: playback clean on web and Android; discount math correct.

### Intent 2.1a - Learning page pilot: Hanuman Chalisa verse-by-verse

- **Intent:** The first concrete build-out of Intent 2.1's learning experience -
  **text-only** (no audio/video yet), scoped to **Hanuman Chalisa** (the
  smallest japam - 2 opening dohas, 40 chaupais, 1 closing doha). A new
  **Learning** nav page where users read/learn verse by verse in **English,
  Malayalam, or Sanskrit** (romanized, never Devanagari, per app convention)
  via a language-select dropdown. Marking a verse learned auto-completes
  today's Hanuman Chalisa anushtanam on the dashboard.
- **Commit type:** `feat:`
- **Open question - version bump:** whether shipping this page is itself what
  cuts `1.0.0` (vs. the existing "Play Store launch cuts 1.0.0" rule tied to
  the Phase 0 blockers) is **undecided** - revisit before building.
- **Content architecture (sustainability):** the catalog will eventually cover
  much larger works - Vishnu/Lalitha Sahasranamam (1000 names each),
  Narayaneeyam (1034 verses), Bhagavad Gita (700 verses), and an open-ended
  Bhagavatam. Bundling that into the JS/app binary forever would compound Play
  Store install-conversion loss (~1% per 6MB of download size, confirmed via
  Google's own guidance) and force an app release for every content fix. So:
  - Verse text lives in a **Supabase Storage public bucket**, one JSON file per
    stotram (`learning-content/hanuman-chalisa.json`, all 3 languages) - not in
    the JS bundle. Public buckets get a high CDN cache-hit rate on Supabase's
    Smart CDN; updates propagate in ~60s via a versioned path/cacheNonce, no
    app release needed.
  - A thin manifest (extend `practices` with `has_learning_content` /
    `storage_path`, or a small `learning_content` table) lists what's available
    - same "admin-extendable without app update" spirit as `practices-catalog.md`.
  - Client fetches a stotram's JSON once, caches it (localStorage/IndexedDB) for
    offline reuse after first open - the same pattern YouVersion uses for
    scripture delivery, confirmed via their published offline architecture.
- **Progress tracking:** new `learning_progress` table, one row per learned
  verse per subject, same shape and RLS pattern as `practice_logs`:
  ```sql
  create table public.learning_progress (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    family_member_id uuid references public.family_members(id) on delete cascade,
    content_slug text not null,
    verse_id text not null,
    learned_at timestamptz not null default now()
  );
  create unique index learning_progress_unique on public.learning_progress
    (owner_id, coalesce(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid), content_slug, verse_id);
  ```
- **Dashboard/streak wiring - reuse existing machinery, no new streak logic:**
  `hanuman-chalisa` already exists as a `daily`-cadence row in `practices`. On
  marking a verse learned: if the subject doesn't already track it, auto-add it
  (`addPractice`, same one-tap flow `SuggestedPractices` already uses in
  `TodayPage.jsx`); if today's Hanuman Chalisa isn't already marked done
  (`isDoneToday` from `utils/cadence.js`), call the existing `submit(userPracticeId)`
  from `useToday` - the same `submit_practice_log` RPC `TodayPage.mark()`
  already calls. One verse learned = today's anushtanam marked; streak, punya,
  and the celebration modal are all handled by existing code, unchanged.
- **Premium gating:** per Intent 2.1, tier-gated - this is the first concrete
  content behind that gate.
- **Open questions:**
  - Auto-track Hanuman Chalisa on first verse learned, vs. requiring the user
    add it from Today first.
  - After all verses are learned, does continuing to open Learning and review a
    verse keep auto-marking the daily practice (simplest: yes, same rule
    forever), or does daily marking then only come from Today?
- **Testing Gate:**
  - Unit: verse-learned handler auto-adds the practice when untracked; skips a
    duplicate `submit_practice_log` call when today is already done; a content
    fetch failure shows a retry state, not a crash.
  - Component: language dropdown renders the correct script/text; a verse's
    learned state persists across reload (from `learning_progress`).
  - Manual: mark a verse, confirm Today's Hanuman Chalisa flips to done and the
    streak increments; re-opening a previously-loaded stotram offline works
    without network.

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

### Intent 2.6 - Ad-free upgrade (₹99/year) + friction dial (post-launch)

> Post-launch monetization. Ships the **paid escape first**, then turns up ad
> friction - never friction without an escape (launch stays light, per 0.2).

- **Intent:** Convert ad-annoyed users with a cheap, values-framed upgrade:
  **₹99/year ad-free** - "you already pay for Netflix and distractions; ₹99 for
  your daily good karma." Once the upgrade is live, raise interstitial frequency
  (the friction that drives conversion). This is the fastest post-launch revenue
  path and simpler than the karaoke/AV premium (2.1). The existing `ad_free_until`
  column already gates ads (referral uses it), so a subscription plugs straight in.
- **Commit type:** `feat:`
- **Dependency:** Google Play Billing (or RevenueCat) + a Play Console
  subscription product; server-side purchase validation.
- **Changes:**
  - ₹99/year subscription via Play Billing; on purchase, set the ad-free flag /
    extend `ad_free_until` (server-validated, not client-only).
  - Raise interstitial frequency now that the escape exists (data-tuned against
    the `ad_shown` + retention analytics).
  - **"Go ad-free for ₹99/year 🪔"** CTA (values pitch), surfaced right after an
    ad and on Profile; the referral's existing 1-month ad-free is the free taste
    that primes the upgrade.
  - Restore purchases; expiry re-enables ads.
- **Testing Gate:**
  - Play Billing **sandbox**: purchase grants ad-free; ads suppressed; restore
    works; expiry re-enables ads.
  - `upgrade_cta_shown` / `upgrade_purchased` analytics fire; conversion is
    measurable against ad frequency.
  - Server validates the purchase (no client-only unlock).

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

### Intent 2.7 - Today page panchangam info box

> Research-first per Sreeni - do not build until the open questions below are
> resolved. This is a **smaller, standalone slice** of the fuller "Panchangam /
> calendar integration" already scoped in `docs/ROADMAP.md` - that item stays
> the bigger post-launch calendar view + thithi-based scheduling (Intent 2.4
> depends on it); this Intent is the narrower "just show today's info" version
> and should share whichever data source 2.4/`ROADMAP.md` ultimately picks.

- **Intent:** A small info box on the Today dashboard showing the day's
  panchangam details alongside the date - era/varsham name, Malayalam and
  Tamil month+day, thithi, nakshatra, and the inauspicious windows (Rahu Kalam,
  Yamagandam, Gulika Kalam). Example shape: "16 July 2026, Thursday - Parabhava
  Varsham - [Malayalam month/day] - [Tamil month/day] - [thithi/nakshatra/kalam
  times]."
- **Commit type:** `feat:`
- **Correction found during research:** the example year name needs care - the
  60-year Samvatsara cycle has two similarly-named-but-distinct years:
  **Prabhava** (1st in the cycle, 1987-88) and **Parabhava** (40th, 2026-27).
  The year starting in 2026 is **Parabhava**, not Prabhava - easy to mix up,
  and wrong on a dharma app is a visible, checkable mistake to knowledgeable
  users.
- **Open question - regional start-date convention:** the Samvatsara start date
  differs by tradition - North Indian/lunar reckoning (Chaitra Shukla
  Pratipada, ~19 March 2026) vs. South Indian solar reckoning (Mesha
  Sankranti / Tamil-Malayalam New Year, mid-April). Since the household
  audience references **Pambu Panchangam** (a Tamil publication) and the app
  shows Malayalam alongside Tamil, confirm which start-date convention to
  follow before building - the varsham name must not flip a month "early"
  relative to what users' own physical panchangam shows.
- **Data source - do NOT scrape Pambu Panchangam's PDF directly.** It's a
  specific copyrighted publication (Manonmani Vilasam Press, Chennai, since
  1883); reproducing its exact calculated tables is an IP concern, and
  PDF-scraping is fragile (breaks on layout changes every year). The
  underlying astronomical method (drik ganita: Swiss Ephemeris + an ayanamsa)
  is not proprietary to Pambu Panchangam - every modern panchang source
  computes from the same open astronomy, with minor timing differences from
  ayanamsa/convention choice. Two legally-clean options, either works:
  1. **Commercial Panchang API** - e.g. Prokerala's Astrology API (free tier:
     5,000 credits, 5 req/min; basic Panchang call = 10 credits; regional
     calendar call for Tamil/Malayalam month+day = 2,000 credits; has
     Tamil/Malayalam/Telugu localization built in).
  2. **Self-computed, open source** - `drik-panchanga` (Python, Swiss
     Ephemeris-based, the reference implementation most other tools build on)
     for the core panchangam math; `kollavarsham` (npm, TypeScript) for
     Malayalam month/day conversion out of the box. No ready-made Tamil-
     calendar npm package exists - Tamil solar months use the same
     sidereal-ingress logic as Malayalam (same computation, different
     month-name table and epoch), not a separate problem.
- **Precompute once, not live per request** - matches the framing that started
  this: "the panchangam PDF comes out every Feb/March, and that year's dataset
  is constant." A script/Supabase Edge Function run ~once a year computes/fetches
  all ~365 days of `{date, thithi, nakshatra, rahu_kalam, yamagandam,
  gulika_kalam, tamil_month_day, malayalam_month_day, varsham_name}` and stores
  it as a small precomputed dataset - unlike the free-text stotram content in
  2.1a, this is structured and date-keyed, so an ordinary Supabase table (or
  even a bundled JSON, tens of KB for a year) fits fine; no Storage-bucket
  treatment needed. Today's page does a same-day lookup - zero ongoing API
  cost, zero live astronomical computation per page load.
- **Open question - location dependency:** Rahu Kalam / Yamagandam / Gulika
  Kalam are sunrise-based clock times that shift with the user's exact
  location. Precomputing for one reference location (e.g. Kerala) is simplest
  for v1; true per-user-location precision is a later enhancement, and would
  tie naturally into Intent 2.4's location/sunrise-based reminder work.
- **Testing Gate:**
  - Unit: date-lookup function returns the correct precomputed row; falls back
    gracefully if a date is missing (e.g. year boundary before next year's data
    is loaded).
  - Manual: cross-check a sample of dates against a printed/PDF Pambu
    Panchangam or another trusted panchang source to confirm thithi, nakshatra,
    kalam times, and the varsham name match what users expect.
  - **Annual maintenance task** (documented, matching the Feb/March publish
    cadence): regenerate next year's dataset before the current one runs out.

---

## Global Definition of Done (applies to every Intent)

1. Code + tests written; the Intent's specific Testing Gate is green locally.
2. Conventional-commit message with the correct prefix (drives the SemVer bump).
3. PR opened; the R1 CI pipeline (lint, test, build, e2e) is green.
4. Required checks satisfied under branch protection; PR merged to `main`.
5. release-please rolls the change into the next Release PR; merging it cuts the
   version, changelog, tag, and GitHub Release automatically.
