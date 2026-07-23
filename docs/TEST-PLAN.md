# Nithyakarma Tracker - Test Plan & User-Flow Map

Status: **v2 (2026-07-23)**, superseding draft v1 (2026-07-11). Rebuilt from a full
read of every component/hook/util in `app/src` and every test file in the repo
(Vitest, Playwright, Android adb scripts, Deno, SQL) - not incremental notes. Covers
every user flow, the test type(s) that own it, UI/UX state checks, and accessibility
(WCAG 2.1 AA) checks, across all three runtime surfaces, plus what actually executes
in CI versus what is manual-only.

v1 predates and never covered: Learning Hub / Ramayanam / Kandam PDF readers,
Panchangam tradition display + preference, Monthly Special Banner, tharpanam/observance
notification sub-toggles, referral rate-limiting, the female onboarding journey spec,
`auth-negative.spec.js`, the CI job structure, and the 2027 panchangam data. This
revision fills those in and adds an explicit CI-reality and known-gaps section, since
"a test file exists" and "a test file runs automatically" turned out to be different
claims for a meaningful slice of this suite.

## Surfaces
| Code | Surface | How tested |
|---|---|---|
| W | Web desktop (Chromium) | Playwright e2e + manual |
| Mw | Mobile web (responsive < 768px) | Manual (no dedicated Playwright mobile-viewport project configured) |
| A | Android native (Capacitor, API 24-36) | adb-driven shell scripts (crash-only assertions) + manual on emulator/device |

Capacitor wraps the same React build for Android as a WebView - there is no separate
native UI. "Android-only" below means Capacitor-plugin-driven behavior (push via FCM,
AdMob, local-notifications, in-app-review, share sheet, haptics, OAuth deep link), not
a different screen.

## Test layers
- **Unit** (Vitest + Testing Library + jsdom) - pure logic (`utils/`), hooks, components. 61 test files.
- **Integration** (SQL via Supabase MCP, always `begin;...rollback;`) - RPCs, RLS, triggers, constraints, grants (`supabase/tests/integration-assertions.sql`, 19 numbered sections). Run manually via Supabase MCP `execute_sql`, never in CI.
- **Deno** (`supabase/functions/_shared/observanceMatch.test.ts`) - the tharpanam/observance rule-matching engine. Runs in CI as of 2026-07-23 (`edge-functions` job) - the first Deno test ever wired into CI.
- **E2E web** (Playwright, `app/e2e/*.spec.js`) - full flows against a real built app + live Supabase.
- **E2E Android** (adb screenshot-tap shell scripts, `app/e2e/*.sh`) - build/install/launch + blind taps at hardcoded coordinates. **Assert only "no crash" via logcat + `pidof`** - no in-app text/state assertion is possible (WebView exposes no accessibility tree to `uiautomator`). Pass beyond that requires eyeballing saved screenshots and cross-checking DB state via Supabase MCP.
- **UI/UX** - loading / empty / error / success states, responsiveness, celebration.
- **A11y** - `axe-core` automated scan (`a11y.test.jsx`) + manual labels/contrast/keyboard/focus/touch-target/motion review.

### Test accounts
| Account | Purpose | Seed | Fate |
|---|---|---|---|
| `e2e@nithyakarma.test` | Preserved manual UI account | - | Kept until Play Store prod release, never deleted |
| `integtest@nithyakarma.test` | Profile-less, for rolled-back SQL assertions | - | Never mutated (transaction always rolls back) |
| `e2efull@nithyakarma.test` | Male full-journey destructive Playwright spec | `seed-e2efull.sql` | Deleted at end of `journey.spec.js`; reseed before each run |
| `e2efemale@nithyakarma.test` | Female onboarding destructive Playwright spec | `seed-e2efemale.sql` | Deleted at end of `journey-female.spec.js`; reseed before each run |
| `referral-throwaway@nithyakarma.test` | Referral-code-applied Playwright spec | `seed-referral-throwaway.sql` | Self-deletes at end; requires `E2E_REFERRAL_THROWAWAY_PASSWORD`/`E2E_REFERRER_CODE` env (unset in CI, so this spec never actually runs there) |
| `android-sandhya-throwaway@...` | Pre-onboarded (male, ad-free, sandhya tracked) for `android-sandhya.sh` | `seed-android-sandhya-throwaway.sql` | Manual, drop-then-create each run |
| `android-referral-throwaway@...` | Not pre-onboarded, for `android-referral.sh`'s manual referral-entry test | `seed-android-referral-throwaway.sql` | Manual, drop-then-create each run |

---

## Android tooling (this dev machine, verified 2026-07-14)

- **Android Studio** runs on Sreeni's desktop session (GUI) - it is not
  filesystem-visible from an agent's sandboxed shell, so an agent can't launch
  it directly. What an agent *can* do: connect to whatever emulator/device is
  already running via `adb`, which talks to a local `adb` server over
  `localhost:5037` regardless of which process started the emulator.
- **SDK location**: `~/Android/Sdk` (`$ANDROID_HOME` / `$ANDROID_SDK_ROOT`).
  - `adb`: `~/Android/Sdk/platform-tools/adb`
  - `emulator`: `~/Android/Sdk/emulator/emulator`
  - AVDs: `~/.android/avd/`
- **Build + install a fresh debug build** (from `app/`):
  ```
  npm run build && npx cap sync android
  cd android && ./gradlew assembleDebug
  adb uninstall org.nithyakarma.app   # clean slate, optional
  adb install app/build/outputs/apk/debug/app-debug.apk
  adb shell am start -n org.nithyakarma.app/.MainActivity
  ```
- **Driving the UI from an agent (no display server available)**: the WebView is
  `NAF="true"` ("not accessibility friendly") - `uiautomator` sees nothing, so
  interaction is screenshot-then-tap:
  ```
  adb exec-out screencap -p > screen.png   # inspect, pick a target pixel
  adb shell input tap <x> <y>              # native-resolution coordinates
  adb shell input text "..."               # text fields (spaces are unreliable)
  adb shell input keyevent KEYCODE_BACK
  ```
  Three things reliably intercept blind taps and must be dismissed first: the
  Android 13+ OS notification-permission dialog, the driver.js guided tour on first
  run, and a live AdMob test interstitial (seed `ad_free_until` into the future to
  remove the third hazard).
- **Logs**: `adb logcat -d -t <N> | grep -iE "nithyakarma|capacitor|error"`.
- **Manual pre-release gate**: reseed the relevant throwaway account via its
  `seed-*.sql` (Supabase MCP) before each run.

---

## Web tooling (this dev machine)

Per this machine's standing instructions, browser automation for this project uses
`/playwright-cli` (headless on this Kali box, no display server) or the Electronium
MCP - never `claude-in-chrome`, which is unsupported here.

- **Electronium**: `electronium_launch` attaches to Chrome via CDP (port 9222).
  Navigation is https-only, so it cannot reach a local Vite dev server - test
  against a deployed `https://` target (now `https://app.nithyakarma.org`, or a PR's
  Netlify deploy-preview URL) instead. Queued actions (`navigate`, `click_selector`,
  `click_text`, `type`, `evaluate`) require a follow-up `electronium_approve`.
  Read-only inspection (`screenshot`, `page_snapshot`) needs no approval.
- **Login is manual, always** - Claude never types account passwords into the login
  form, including for e2e test accounts. Sreeni enters credentials manually; Claude
  picks up testing once the Today page loads.

---

## CI reality (`.github/workflows/ci.yml`) - what actually runs automatically

This is the single most important cross-check against v1, which implied far more
automatic coverage than exists. Three parallel jobs on every PR and push to `main`:

| Job | Runs | Notes |
|---|---|---|
| `verify` | `npm run lint` -> `npm run test` (all Vitest, 61 files) -> `npm run build` | Full unit/component/hook/util suite, real gate |
| `edge-functions` | `deno test supabase/functions/_shared/observanceMatch.test.ts` | Added 2026-07-23; only Deno test in the repo; `send-reminders`/`send-test-notification` themselves have **zero** test coverage |
| `e2e` | `npx playwright test --grep-invert "@destructive"` | Excludes any test titled with `@destructive` |

**What the `e2e` job's filter actually leaves running:**
- `auth-negative.spec.js` - **runs in CI**, no seed needed.
- `auth-signout.spec.js` - not destructive-tagged, but self-skips (`test.skip`) because `E2E_UI_EMAIL`/`E2E_UI_PASSWORD` are not among CI's secrets. **Effectively never runs in CI.**
- `referral.spec.js` - not destructive-tagged, but self-skips because `E2E_REFERRAL_THROWAWAY_PASSWORD`/`E2E_REFERRER_CODE` are unset in CI. **Effectively never runs in CI.**
- `journey.spec.js`, `journey-female.spec.js` - excluded by the `@destructive` grep. **Manual pre-release gate only.** These are the only specs that exercise Sandhyavandhanam end-to-end, family-member add, delete-account, and leaderboard opt-in persistence at the UI layer.

**Never run in CI, ever** (no job references them): `integration-assertions.sql` and
all `seed-*.sql` (manual via Supabase MCP), the three `android-*.sh` scripts (need a
real/emulated device), and the Android `androidTest`/`test` Gradle tasks (which are
unmodified Capacitor boilerplate anyway - see Known Gaps).

Net effect: **the backend correctness net (RPCs, triggers, RLS, streaks, referrals) and
the true end-to-end Sandhyavandhanam/family/delete flows both depend on someone
running things manually.** Nothing in CI would catch a regression in either area.

---

## 1. User-flow map (all flows, condensed)

1. **App shell / routing gate** (`App.jsx` `Gate()`) - loading watchdog (15s ->
   Reload fallback); legal/info routes (`/terms`, `/privacy`, `/about`, `/karma`)
   reachable standalone regardless of session; `/reset` reachable on a bare recovery
   session; auth gate; onboarding gate; one-shot notification-prompt arming keyed to
   onboarding having just completed (never re-arms for a returning user).
2. **Auth** - sign up (email, with/without email-confirmation on), sign in (email),
   Google OAuth (web: page redirect; Android: custom-scheme deep link via
   `appUrlOpen`), invalid creds, password min-length (8 at signup, **6 at reset -
   inconsistent**), mode toggle, forgot/reset password (enumeration-safe copy), sign
   out, session revalidation on resume/visibility-change.
3. **Onboarding** - value-prop intro -> form; name + required gender + optional
   referral (auto-filled from `/r/:code` or `?ref=`); male -> Sandhyavandhanam
   auto-added; female -> no auto-add (lands on empty Today -> suggested practices);
   invalid/self referral code fails **silently** (no error shown, signup still
   succeeds).
4. **Guided tour** - 2 or 3 steps depending on `gender==='male' && hasSlots`;
   localStorage-gated once-per-device (not per-account); tour-seen suppressed (not
   re-shown) if localStorage is blocked, opposite of the naive expectation.
5. **Today / mark** - list scheduled practices (cadence-filtered); profile switcher
   (self vs family); mark general practice -> celebration only from a *verified*
   RPC response (`saved:true`); busy/disabled state per-card; ad + review-prompt
   precedence ("never both" - review wins at a milestone, ad otherwise); local-push
   suppression on day-complete (Android only).
6. **Sandhyavandhanam 3-slot** - Morning/Noon/Evening; any 1 of 3 completes the day
   and streak (2026-07-20 change); progress copy 0/1-2/3; slots stay clickable after
   day-complete (extra punya); "!" info toggle independent of tour.
7. **Add practice** - dropdown + search; already-tracked dimmed; Sandhyavandhanam
   hidden unless subject is male **and** (self, or family member with
   `upanayanam_done`); focus-trapped, Escape closes.
8. **Cadences** - daily, daily_count (target stored verbatim), weekly (weekday-gated,
   no off-day streak break), sequence (position increments, cycles at length).
9. **History** - past logs grouped by date, sandhya shown as x/3; hard-capped at 300
   logs with no pagination UI; profile-switch reloads.
10. **Notifications** - first-run prompt (gender-aware copy, skippable); settings
    toggle (master + tharpanam/observance sub-toggles, sub-toggles disabled unless
    master on); web push (VAPID) vs Android FCM transport split; self-heal on mount
    (re-subscribe silently if lost, show blocked-guidance if permission revoked,
    never auto-prompt on a reset/`default` permission); "Send test notification".
    The first-run prompt's arming logic (`justOnboarded` flag) fires exactly once,
    right when `createProfile()` completes - not on ordinary sign-ins (fixed
    2026-07-23, see Known Gaps).
11. **Monthly Special Banner** - DB-driven per-month nudge on Today, silent no-op if
    no row for the current month, per-month localStorage dismiss.
12. **Panchangam display** - today's row by local date, silent no-op if none exists
    (future/unpopulated dates); Tamil vs Malayalam tradition branch (different
    fields, different script maps), default Tamil; native-script lookup misses fall
    back to raw value rather than blanking.
13. **Learning Hub / verse reading** - flat reader (Hanuman Chalisa, Vishnu
    Sahasranamam - language toggle, YouTube link, no per-verse "mark learned"
    affordance by design); Ramayanam kandam picker (6 kandams, Uttara excluded);
    Kandam sarga PDF reader (URL param > last-read localStorage > default 1; pdf.js
    canvas rendering, not iframe, since WebView has no native PDF plugin); stale
    revalidation failures swallowed silently once cached content is already shown.
14. **Ramayana Masam page** - static Karkidakam-reading explainer, no data fetching.
15. **Sabha (leaderboard)** - opt-in gated (`community_enabled`) both at the nav-tab
    level and independently re-checked on direct `/sabha` navigation; Week/Month/Kids
    tabs; own row pinned even when ranked below the returned page; Hall banner
    suppressed if the #1 score is 0.
16. **Referrals** - apply at onboarding; own page listing referred users + reward
    tags; invite via WhatsApp (3 independent entry points: Referrals page, Profile
    card, Celebration modal); server-side 24h/5-referral rate limit exists but the
    UI's reward copy ("+1 mo", "+1") is static and does not reflect it.
17. **Profile & family (Bala Sabha)** - edit name; add family member (gender,
    upanayanam toggle for boys, Bala-Sabha opt-in **default true**, asymmetric with
    the parent's own leaderboard opt-in which **defaults false**); remove (native
    `confirm()`, cascades logs); panchangam tradition preference (optimistic,
    revert-on-failure); community/leaderboard-visibility toggles (independently
    decoupled - 4 reachable combinations); delete account (type-your-email exact
    match, RPC cascade, no secondary confirm dialog).
18. **Streaks & tiers** - per-practice + overall streak continuity/reset; freeze
    credits (consumed on exactly-1-day gap, capped by tier, topped up on tier-up);
    tiers Shishya -> Sadhaka -> Yogi -> Rishi -> Brahmarishi.
19. **Ads** - Android-only interstitial, once per app session, skipped when
    ad-free or when the in-app-review prompt already fired this mark; G-rated;
    never blocks/depends on the celebration flow.
20. **Resilience / error states** - offline, network error, expired session, RLS
    denial, PostgREST failure - handled inconsistently across call sites (see Known
    Gaps: `friendlyError()` is not used everywhere it plausibly should be).
21. **Accessibility** - focus management/traps (Onboarding, dropdown, Celebration
    modal), `role="alert"` banners, ARIA landmarks/labels, Escape-to-close, heading
    hierarchy, touch targets, `prefers-reduced-motion`, automated axe-core scan on 7
    surfaces.

---

## 2. Flow-by-flow test matrix

Legend: ✅ covered · ⚠️ covered but manual-only / CI-excluded / caveat · ⬜ no coverage found.

### App shell / routing gate
| Case | Layer | Status |
|---|---|---|
| Loading watchdog shows spinner then Reload fallback after 15s | Unit (`App.test.jsx`) | ✅ |
| Legal/info routes render standalone regardless of session | Unit (`a11y.test.jsx` renders Terms/Privacy/About/Karma) | ✅ (render only, not routing-gate logic itself) |
| Notification-prompt arms once, right after onboarding, never re-arms for a returning user | Unit (`App.notification-prompt.test.jsx`) | ✅ |
| `/reset` reachable on a bare recovery session | Unit (`ResetPassword.test.jsx`, mocked) | ⚠️ (component-level only, not the Gate's routing branch) |

### Auth
| Case | Layer | Status |
|---|---|---|
| Google + email offered on web; hidden in `forgot` mode | Unit (`AuthPage.test.jsx`) | ✅ |
| Email/password sign in calls `signInEmail` | Unit | ✅ |
| Signup switches modes + verification notice (no session returned) | Unit | ✅ |
| Signup with session returned skips the verification notice | Unit | ✅ |
| Invalid credentials shows server error | Unit + E2E(W) | ✅ |
| Password minLength 8 at signup blocks submit | Unit + E2E(W, `auth-negative.spec.js`) | ✅ |
| Password minLength **6** at reset (inconsistent with signup's 8) | - | ⬜ not tested, mismatch itself not flagged anywhere |
| Mode toggle login<->signup | E2E(W, `auth-negative.spec.js`) | ✅ |
| Forgot-password enumeration-safe copy (same message whether or not account exists) | - | ⬜ |
| Reset-password success redirects to `/` after 1.5s | Unit (`ResetPassword.test.jsx`) | ✅ |
| Reset-password error (e.g. expired link) | Unit | ✅ |
| Sign out returns to auth | E2E(W, `auth-signout.spec.js`) | ⚠️ **effectively skipped in CI** (missing `E2E_UI_EMAIL`/`PASSWORD` secrets) |
| Google native OAuth: appUrlOpen completes session from URL fragment | Unit (`useAuth.test.jsx`) | ✅ |
| Google native OAuth: malformed/missing tokens in the redirect fragment fail silently, no error shown | - | ⬜ |
| Session revalidates on native resume / web visibilitychange | Unit (`useAuth.test.jsx`) | ✅ |
| `getSession()` rejecting still resolves `loading=false` (24h-idle stuck-loading regression) | Unit | ✅ |
| Session-expiry mid-`submit()` shows a raw Supabase message, not `friendlyError()`'s copy | - | ⬜ (see Known Gaps) |

### Onboarding
| Case | Layer | Status |
|---|---|---|
| Intro -> form, focus moves to name field | Unit (`Onboarding.test.jsx`) | ✅ |
| Gender required, blocks submit | Unit | ✅ |
| Referral code flows through from `/r/:code`/`?ref=` to `createProfile` | Unit | ✅ |
| Male -> Sandhyavandhanam auto-added | Integration + E2E(W, `journey.spec.js` @destructive) | ✅ / ⚠️ manual-gate only |
| Female -> no Sandhyavandhanam, lands on suggested-practices empty state | E2E(W, `journey-female.spec.js` @destructive) | ⚠️ manual-gate only |
| Sandhya-association trigger blocks female / boy-without-upanayanam at the DB layer | Integration (§2, §3) | ✅ |
| Referral code applied at signup (valid) | Integration (§9) + E2E(W, `referral.spec.js`) | ✅ / ⚠️ **effectively skipped in CI** (missing secrets) |
| Self-referral / invalid code rejected server-side | Integration (§9) | ✅ |
| Invalid/self referral code fails **silently** client-side (no error UI) | - | ⬜ |
| Referral rate limit: max 5 credits per referrer per rolling 24h | Integration (§9b) | ✅ (backend only, no UI-level test of the 6th-referral rejection path) |

### Guided tour
| Case | Layer | Status |
|---|---|---|
| 3-step tour for male users with sandhya slots present | Unit (`GuidedTour.test.jsx`) | ✅ |
| Sandhya step omitted when not applicable | Unit | ✅ |
| Sandhya step dropped even for male users if the DOM element is absent | Unit | ✅ |
| Runs once on first ready render, not before, not again once seen | Unit | ✅ |
| Marks itself seen via driver.js `onDestroyed` | Unit | ✅ |
| Tour-seen persistence is per-device (localStorage), not per-account | - | ⬜ (a second account on the same device never seeing the tour is unverified) |
| Blocked/unavailable localStorage suppresses the tour rather than re-showing it every load | - | ⬜ |

### Today / mark & Sandhya 3-slot ← the most heavily tested area
| Case | Layer | Status |
|---|---|---|
| Data load filtered by cadence-schedule for today | Unit (`cadence.test.js`, `useToday.test.js`) | ✅ |
| Load error -> `ErrorBanner` + Retry, recovers | Unit (`useToday.test.js`) | ✅ |
| Empty list -> `SuggestedPractices` one-tap add | Unit (`TodayPage.test.jsx`) | ✅ |
| Profile switcher (self/family) reloads subject's items | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Mark general practice -> celebration only from verified (`saved:true`) response | Unit + E2E(W) | ✅ |
| `saved` falsy/missing throws "Save could not be verified", no celebration/ad/haptic | Unit (`useToday.test.js`) | ✅ |
| **Sandhya 1 slot -> "1 of 3", streak day-complete (2026-07-20 rule)** | Unit(cadence) + Integration(§8) + E2E(W, `journey.spec.js`) + E2E(A, `android-sandhya.sh`) | ✅ / ⚠️ Android script only proves no-crash, not correctness |
| Sandhya 2 slots -> "2 of 3", still counted complete, no double streak advance | Integration(§8) + E2E(W) | ✅ |
| Sandhya 3 slots -> "All 3 done", punya accumulates per slot (5/10/15) | Integration(§8) + E2E(W) | ✅ |
| Re-marking an already-done slot rejected | Integration(§8) | ✅ |
| Duplicate same-day/same-practice log rejected (unique index) | Integration(§4) | ✅ |
| Sandhya card keeps all 3 slot buttons clickable after day-complete (extra punya) | - | ⬜ explicit UI test not found |
| `countsTowardDayCompletion` vs `isDoneToday` divergence for `counts_toward_streak=false` logs | Unit (`logic-mirrors.test.js`) | ✅ |
| Reward precedence: milestone review shown -> ad skipped this turn; else ad shown | - | ⬜ no test asserts the "never both" precedence itself (ad and review are each unit-tested in isolation, not their interaction site in `TodayPage.mark()`) |
| `day_complete=true` but `overall_streak===0` does NOT show celebration | Unit (`TodayPage.test.jsx`) | ✅ |
| Local-push suppression fires on day-complete (Android) | Unit (`notifications.test.js`) | ✅ |
| Ad fires after verified save, before celebration | Unit (`TodayPage.test.jsx`) | ✅ |
| Ad capped at 1/session, skipped when ad-free, never on failed save | Unit (`ads.test.js`) | ✅ |
| CelebrationModal share card's `data.tier` field | - | ✅ verified 2026-07-23 via the live `submit_practice_log` function definition (Supabase MCP) - it returns `tier`, and `TodayPage.mark()`'s spread carries it through. Not a bug. |
| p_award_streak passthrough (learning-style marks don't advance streak) | Unit (`useToday.test.js`) + Integration(§17) | ✅ |
| Client-supplied local date honored within ±1 day, falls back beyond that (anti streak-gaming) | Integration(§10b) | ✅ |

### Add practice / cadences
| Case | Layer | Status |
|---|---|---|
| Sandhya hidden for female / no-upanayanam subject in dropdown | Unit (`TodayPage.test.jsx`) | ✅ |
| Sandhya shown for self (male) and for family boy with upanayanam | Unit | ✅ |
| Already-tracking dimmed & disabled | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Add error keeps dropdown open, shows inline error | - | ⬜ |
| Escape closes dropdown, focus trap active | - | ⬜ (hook `useFocusTrap` itself untested directly; only exercised indirectly via CelebrationModal focus tests) |
| Weekly practice scheduled only on its weekday | Unit(cadence) + Integration(§15) | ✅ |
| Weekly continuity across exactly one week, reset after a missed week | Integration(§15) | ✅ |
| RPC refuses to log a weekly practice on a non-matching weekday | Integration(§15) | ✅ |
| `daily_count` target (108) stored verbatim | Integration(§10) | ✅ |
| Sequence position increments and cycles at length | Integration(§11) | ✅ |

### History
| Case | Layer | Status |
|---|---|---|
| Empty state, no practices tracked | Unit (`HistoryPage.test.jsx`) | ✅ |
| Groups logs by date once loaded | Unit | ✅ |
| Error + Retry instead of silent stuck spinner | Unit | ✅ |
| 300-log hard cap with no pagination, high-volume account | - | ⬜ |
| Sandhya shown as x/3 per day | E2E(W, `journey.spec.js` implied via card text) | ⚠️ manual-gate only, no direct unit assertion on History's x/3 rendering found |

### Notifications
| Case | Layer | Status |
|---|---|---|
| Toggle enable/disable (web) saves preference | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Unsupported browser shows message instead of controls | Unit (`NotificationSettings.test.jsx`) | ✅ |
| Web permission `denied` blocks toggle-on with guidance, no browser re-prompt attempted | Unit (`useNotifications.test.jsx`) | ✅ |
| Web permission `default` requests, error copy differs from the pre-denied case | Unit | ✅ |
| Native: `scheduleAllReminders` denial blocks before FCM registration is attempted | Unit | ✅ |
| Native: FCM registration failure rolls back the just-scheduled local reminders | Unit | ✅ |
| DB `enabled` flag only flips true after subscribe **and** save both succeed | Unit | ✅ |
| Self-heal on mount: re-subscribe silently if lost, show blocked-guidance if permission revoked, no surprise prompt on `default` | Unit (web + native variants) | ✅ |
| Reactive un-stick via Permissions API listener (web) when user re-grants outside the app | - | ⬜ (hook wiring exists per code; no test found exercising the listener callback itself) |
| Tharpanam/observance sub-toggles disabled unless master is on | Unit (`NotificationSettings.test.jsx`) | ✅ |
| Tharpanam/observance toggle optimistic update + revert on failure | Unit (`useNotifications.test.jsx`) | ✅ (revert covered for tharpanam; observance revert not explicitly listed) |
| "Send test notification" reports device count / no-subscription / call-failure | Unit + Manual round-trip (both platforms, 2026-07-14) | ✅ |
| FCM token saved on first registration and on rotation; stale-account token reclaimed | Unit (`pushAndroid.test.js`) | ✅ |
| `reminders` notification channel created | Unit | ✅ |
| Foreground-received push manually re-raised as a local notification (Android) | Unit | ✅ |
| Web push subscription reclaimed from a different account before upserting (shared-device safety) | Unit (`webPush.test.js`) | ✅ |
| Missing `VITE_VAPID_PUBLIC_KEY` throws instead of silently no-opping (past prod incident) | Unit | ✅ |
| Delivery dedup unique constraint `(user_id, reminder_date, slot, endpoint)` | Integration(§6) | ✅ |
| `slot` CHECK constraint covers every literal `send-reminders` actually uses, incl. tharpanam/observance | Integration(§19) | ✅ |
| Timezone alias normalization (`Asia/Calcutta` -> `Asia/Kolkata`, old WebView ICU) | - | ⬜ |
| Edge fn sends only within its tz window | Manual (verified 2026-07-14) | ⚠️ manual only, no automated test of `send-reminders` itself |
| `Layout.jsx` unconditional reminder-scheduling | - | ✅ fixed 2026-07-23 - the redundant, ungated call is removed |
| Notification-prompt does not re-show on a normal sign-in of an existing user | Unit (`App.notification-prompt.test.jsx`) | ✅ fixed + regression-tested 2026-07-23 (was showing on every login, not just first onboarding) |
| observanceMatch rule engine (thithi/sankranti/nakshatra/day-offset matching, priority tiebreaks) | Deno (`observanceMatch.test.ts`, CI) | ✅ |

### Monthly Special Banner
| Case | Layer | Status |
|---|---|---|
| Renders nothing with no panchangam row / no special for the month | Unit (`MonthlySpecialBanner.test.jsx`) | ✅ |
| Shows nudge + links to `special.route` when a match exists | Unit | ✅ |
| Dismiss persists per-month via localStorage, resets on month change | Unit | ✅ |
| Dismiss button doesn't trigger the Link navigation | - | ⬜ |
| Behavior when `special.route` is malformed/nonexistent | - | ⬜ |

### Panchangam
| Case | Layer | Status |
|---|---|---|
| Renders nothing while loading / no row for today (year-boundary gap) | Unit (`PanchangamBox.test.jsx`) | ✅ |
| Tamil vs Malayalam field/script rendering branch | Unit | ✅ |
| Defaults to Tamil when `panchangam_tradition` missing (matches DB default) | Unit | ✅ |
| Kalam times labeled IST regardless of viewer timezone | Unit | ✅ |
| Native-script lookup miss falls back to raw value | Unit | ✅ |
| Kollavarsham omitted for rows predating that column (Malayalam) | Unit | ✅ |
| Tradition preference set from Profile, optimistic + revert-on-failure | Unit (`ProfilePage.test.jsx`) | ✅ |
| 2026 generated data: sunset/aparahna day-1 rules, Samvatsara/Kollavarsham rollovers | Unit (`panchangam-output.test.js`) | ✅ |
| 2027 generated data: same class of checks, cross-checked against printed source + DrikPanchang/Prokerala | Unit (`panchangam-2027-output.test.js`) | ✅ |

### Learning Hub / Ramayanam / Kandam reader
| Case | Layer | Status |
|---|---|---|
| Hub lists every learning-enabled practice | Unit (`LearningHub.test.jsx`) | ✅ |
| Flat reader: language default + switch, no "mark learned" affordance, YouTube link | Unit (`LearningPage.test.jsx`) | ✅ |
| Flat reader: unknown slug -> error banner | Unit | ✅ |
| Flat reader: content-specific language sets (VS has Tamil + own video) | Unit | ✅ |
| Content cache: stale-while-revalidate, cache-hit vs cache-miss error surfacing | Unit (`useLearning.test.js`) | ✅ |
| Content cache: race protection on slug change mid-revalidation | Unit | ✅ |
| Ramayanam kandam picker: 6 kandams, Uttara excluded, sarga counts shown | Unit (`RamayanamPage.test.jsx`) | ✅ |
| Kandam reader: unknown kandam slug -> error | Unit (`KandamPage.test.jsx`) | ✅ |
| Sarga resolution priority: URL param > localStorage last-read > default 1 | Unit | ✅ |
| Per-kandam last-read progress kept separate | Unit | ✅ |
| Prev/next bounds, sarga range capped per kandam | Unit | ✅ |
| Language toggle (Sanskrit/Malayalam only) switches PDF url | Unit | ✅ |
| PdfViewer: renders canvas per page, error on load failure, re-renders on src change | Unit (`PdfViewer.test.jsx`) | ⚠️ `pdf.js` fully mocked - **no test exercises a real PDF byte stream/canvas pipeline** |
| RamayanaMasamPage: lists exactly the 6 Karkidakam kandams, Uttara excluded from the list | Unit (`RamayanaMasamPage.test.jsx`) | ✅ |

### Sabha / leaderboard
| Case | Layer | Status |
|---|---|---|
| Community-disabled gate shown, even on direct `/sabha` navigation | Unit (`SabhaPage.test.jsx`) | ✅ (opt-in gate); ⬜ direct-navigation-with-disabled-community specifically |
| Global Week board renders rows | Unit + E2E(W, `journey.spec.js`) | ✅ / ⚠️ manual-gate |
| RPC failure -> error + Retry, not a disguised empty board | Unit | ✅ |
| Kids tab separate, distinct empty-state copy | E2E(W) | ⚠️ manual-gate only |
| Own row pinned + "(You)" | E2E(W) | ⚠️ manual-gate only |
| Own row appended when ranked below the returned page (overflow handling) | - | ⬜ |
| Hall banner suppressed when top score is 0 | - | ⬜ |
| Opt-out hides from others, self still sees own row | Integration + E2E(W) | ✅ / ⚠️ manual-gate |
| Score = completed practice-days (sandhya once per day, not per slot) | Integration | ✅ |

### Profile / family / referrals / delete
| Case | Layer | Status |
|---|---|---|
| Edit name persists, "Saved" state | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Add family member (girl, Bala Sabha opt-in default true) appears as switcher chip + Kids leaderboard | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Boy + upanayanam gets sandhya auto-added | Integration | ✅ |
| Remove family member: native `confirm()`, cascades logs, resets `selectedMember` if it was the removed one | Integration(§13) | ✅ (cascade only) / ⬜ (the `selectedMember`-reset UI behavior itself) |
| Community/leaderboard-opt-in decoupling (4 reachable combinations) | - | ⬜ only the individual toggles are tested, not the combination matrix |
| Tier boundaries match client mirror | Integration + Unit(`tiers.test.js`, `logic-mirrors.test.js`) | ✅ |
| `delete_account` RPC removes auth user (not just profile), `anon` cannot execute it | Integration(§7) | ✅ |
| Delete flow: type-email-to-confirm gate, returns to auth | E2E(W, `journey.spec.js`) | ⚠️ manual-gate only |
| Referral reward copy is static, doesn't reflect the server-side 5/24h cap | - | ⬜ |

### Streaks & freezes
| Case | Layer | Status |
|---|---|---|
| Per-practice streak: continues on consecutive day, resets after a gap | Integration(§12) | ✅ |
| `freeze_cap_for` tier boundaries | Integration(§14) + Unit(`logic-mirrors.test.js`) | ✅ |
| Freeze state machine: gap-0 continues, gap-1-with-credit continues+consumes, gap-1-no-credit resets, gap-2 resets without consuming | Integration(§14) | ✅ |
| Simultaneous tier-up freeze top-up + consume in one call, via a kid subject | Integration(§14) | ✅ |

### Error / offline / resilience (cross-cutting)
| Case | Layer | Status |
|---|---|---|
| `friendlyError()` offline/network/session/permission classification | - | ⬜ no direct unit test of `friendlyError.js` itself found (only exercised indirectly through consuming components' mocked-error tests) |
| `friendlyError()` NOT used in `TodayPage.mark()`'s catch (raw message shown instead) | - | ⬜ inconsistency itself untested |
| `friendlyError()` NOT used in `AuthPage`, `ProfilePage` actions, or `KandamPage`/`PdfViewer` (hardcoded "Could not load this page.") | - | ⬜ |
| Optimistic-toggle silent revert on failure (tradition pref, community/leaderboard opt-in, tharpanam/observance) gives no visible error to the user | - | ⬜ |
| Global 12s Supabase fetch timeout; old WebView without `AbortSignal.timeout` falls back to unbounded fetch | - | ⬜ |
| Watchdog (15s) vs fetch-timeout (12s) race on a genuinely hung request | - | ⬜ |

### Accessibility (WCAG 2.1 AA)
| Check | Where | Status |
|---|---|---|
| Automated axe-core scan | AuthPage, Terms, Privacy, About, Karma, TodayPage-in-Layout (region rule on), CelebrationModal | ✅ (`a11y.test.jsx`, 0 serious/critical as of last run) |
| Contrast tokens (saffron/hero-gradient/danger-zone/tier badges) | global CSS tokens | ✅ (`contrast.test.js`, real WCAG math against `index.css`) |
| Focus trap + return focus | CelebrationModal, add-practice dropdown, Onboarding name-field focus-on-advance | ✅ |
| `role="alert"` on error banners | `ErrorBanner` + inline `.auth-error` | ✅ |
| Escape-to-close | Celebration modal, add-practice dropdown | ✅ (wired separately in each; both tested) |
| Nav landmarks (`aria-label="Primary"`/`"Bottom"`) | Layout | ⬜ not directly asserted in a test, visible in code only |
| Heading hierarchy across pages | all pages | ⬜ not re-verified since v1's manual audit |
| Touch targets ≥44×44 | sandhya slots, nav, chips | ⬜ not re-verified since v1's manual audit; new surfaces (Learning/Kandam prev-next, language toggles, Sabha tabs) never audited |
| `prefers-reduced-motion` | global | ⬜ not re-verified since v1 |
| Android TalkBack / web NVDA-VoiceOver spot check | A / W | ⬜ manual, unautomatable, not run since v1 |
| GuidedTour a11y | - | ⬜ explicitly out of scope (third-party driver.js overlay) |

---

## 3. Known gaps & risks (prioritized)

**Resolved since v2 was first written (2026-07-23), via PR #79 and a same-day follow-up:**
- ~~`Layout.jsx` calling `scheduleAllReminders()` unconditionally on every mount~~ -
  **fixed**: the redundant, ungated call is removed; `useNotifications.js` already
  gates this correctly on the DB `enabled` flag.
- ~~`CelebrationModal` share card's `data.tier` possibly undefined~~ - **verified not
  a bug**: read the live `submit_practice_log` function definition directly via
  Supabase MCP - it does return `'tier', tier_for(v_subject_punya)`, and
  `TodayPage.mark()`'s `{ ...result, subjectName }` spread carries it through intact.
- ~~`auth-signout.spec.js` silently skipped in CI~~ - **fixed**: `ci.yml` was passing
  `E2E_EMAIL`/`E2E_PASSWORD` (the `@destructive` `e2efull` journey account's creds,
  excluded from CI anyway) instead of the `E2E_UI_EMAIL`/`E2E_UI_PASSWORD` this spec
  actually reads for the persistent `e2e@nithyakarma.test` account. `ci.yml` now
  passes both; the `E2E_UI_EMAIL`/`E2E_UI_PASSWORD` repo secrets themselves still
  need to be set (destructive-git-action classifier blocks setting them via agent).
- ~~`android-*.sh` hardcode the pre-rename package `in.co.sreeniverse.nithyakarma`~~ -
  **fixed**: updated to `org.nithyakarma.app` (renamed 2026-07-18, see
  [06-ANDROID.md](architecture/06-ANDROID.md)); every script would have failed at
  launch as written.
- ~~`android-smoke.sh`'s log-string assertions~~ - **fixed**: it grepped for
  Capacitor bridge trace lines (`"Loading app at..."`, `"Handling local
  request..."`) that `loggingBehavior: 'none'` (2026-07-19, a deliberate security
  fix) now suppresses by design - the script reported FAIL on a fully working build.
  Replaced with a boot screenshot for manual confirmation.

**New bug found + fixed 2026-07-23 (during a live full-suite run):**
1. **Every sign-in of an already-onboarded user re-showed the "Turn on reminders?"
   notification prompt**, not just the first one after onboarding. Root cause: the
   old arming logic inferred "onboarding just completed" from `session` appearing
   before `profile` had loaded - but that exact shape also happens on every live
   sign-in of an *existing* user, since `profile` is fetched in a separate async call
   after the `onAuthStateChange` event fires. Caught because `auth-signout.spec.js`
   failed against production: the screenshot showed the notification-prompt's
   "Continue" screen instead of the expected Logout button, for an account that
   already had a profile. Fixed by adding an explicit `justOnboarded` flag to
   `useAuth.jsx`, set only inside `createProfile()` (the one true onboarding-just-
   finished signal) and consumed/cleared by `App.jsx`'s `Gate()` - eliminates the
   race entirely rather than inferring it from timing. `App.notification-prompt.test.jsx`
   rewritten to cover the specific race (session-before-profile on a normal sign-in)
   that used to false-trigger this.
2. **`android-sandhya.sh`/`android-referral.sh`'s login tap sequence was
   miscalibrated**: tapping the email field brings up the on-screen keyboard, which
   scrolls the page up to keep the focused field visible - so the password-field and
   Sign In coordinates (calibrated for the no-keyboard layout) landed on empty space
   or the keyboard itself. Confirmed by hand-driving the flow with corrected
   keyboard-shown coordinates, which reached the throwaway account's clean Today
   page correctly. **Important**: in the *miscalibrated* runs, this intermittently
   landed on `sreeni4298@gmail.com` (a real personal Google account cached on the
   dev emulator) instead of the throwaway account - verified via Supabase MCP both
   times that **no logs were written to that account** (no data was affected), but
   it's a reminder that blind-tap Android E2E on a personal dev machine can reach
   real accounts if a script misses its target. Login-step coordinates are fixed in
   both scripts; the post-login sequence (OS notification dialog, tour dismiss,
   sandhya slots / onboarding form) was **not** re-verified end-to-end in this
   session (stopped after confirming the login fix and the root cause, in favor of a
   human doing the remaining recalibration interactively - far faster with a live
   display than blind screenshot round-trips).
3. Reset-password's `minLength=6` vs signup's `minLength=8` is an inconsistency with
   no test either enforcing the intended value or flagging the mismatch. Still open.

**Coverage that exists on paper but not in CI:**
4. The only UI-level tests of Sandhyavandhanam, female onboarding, family-member
   add, delete-account, and leaderboard-opt-in persistence are `journey.spec.js` /
   `journey-female.spec.js`, both excluded from CI as `@destructive`. A regression in
   any of these flows would only surface at the next manual pre-release run.
5. `referral.spec.js` is not destructive-tagged but self-skips in CI due to missing
   `E2E_REFERRAL_THROWAWAY_PASSWORD`/`E2E_REFERRER_CODE` secrets. Getting it into CI
   is more than adding secrets: the spec self-deletes its throwaway account at the
   end of every run, so CI would need a re-seed step with production DB *write*
   credentials as a new, more sensitive secret, and the referrer account is
   rate-limited to 5 credited referrals per rolling 24h (`integration-assertions.sql`
   §9b) - frequent CI runs would eventually fail for real, not skip. Deliberately
   left manual; referral correctness is already fully covered at the DB layer.
6. `send-reminders` and `send-test-notification` (the actual push-sending Deno
   functions) have no test coverage at all - only their shared `observanceMatch.ts`
   helper does.
7. The three `android-*.sh` scripts assert only "process didn't crash" (plus a
   manually-reviewed screenshot) - no programmatic verification of on-screen text or
   server-side state is possible (WebView exposes no accessibility tree). They
   remain brittle (hardcoded taps calibrated to one 1080x2400 emulator resolution,
   now further calibrated for keyboard-shown vs. no-keyboard layouts too) and are
   not run in CI.
8. `android/app/src/androidTest`/`src/test` are unmodified Capacitor boilerplate
   (`com.getcapacitor.myapp` package assertions that don't even match this app's real
   package) - zero real coverage, and no Gradle test task runs in CI regardless.
9. `logic-mirrors.test.js` compares JS against **hand-copied SQL comments**, not a
   live DB query - it can pass while silently disagreeing with the deployed function
   if a migration lands without the comment being updated in the same commit.

**Smaller untested surfaces worth a look:** HistoryPage's 300-log cap at scale;
PdfViewer never renders a real PDF (pdf.js fully mocked); optimistic-toggle failures
are silent to the user across four different toggles; the referral reward-copy vs.
actual rate-limit-cap mismatch; Sabha's own-row-overflow and Hall-banner-suppression
branches; the Permissions-API reactive un-stick listener.

---

## 4. UI/UX state tests (per screen)
- **States:** loading spinner, empty state (varies per page - "Add your first
  anushtanam", "No anushtanams logged yet", Sabha's scope-specific empty copy),
  error banner + Retry, success/celebration, disabled/busy buttons.
- **Responsive:** no dedicated Playwright mobile-viewport project exists (v1's
  "Mw" row was aspirational) - responsive behavior is manual-only.
- **Celebration modal:** shows only from verified response; share card; Continue;
  Android ad-on-close; Esc closes; focus trap.
- **Profile switcher:** active chip highlighted; switching reloads subject.
- **Visual regression:** none configured (no Playwright screenshot-diff project).

## 5. Manual test window (repeat before each release)
Signed in as e2e (male) and a female profile, on web + Android emulator:
- Auth, onboarding (M/F), guided tour, each cadence type, sandhya 1/2/3-slot
  progression, general practice mark + celebration + share, history, notifications
  enable/disable + test push, leaderboard, learning hub + kandam reader (at least one
  PDF actually renders), monthly special banner (if in-season), panchangam
  tradition switch, profile edit, add/remove family, referral apply, delete-account
  (on a throwaway, never `e2e`), T&C/Privacy reachable standalone.
- Overnight: confirm a reminder fires in a tz window; confirm streak persists to
  Day 2; confirm a missed-day scenario resets correctly.
- Specifically re-verify the post-login Android tap sequence in `android-sandhya.sh`/
  `android-referral.sh` interactively (§3) - only the login step was confirmed fixed.
- Track results in `TEST-RESULTS.md`; file any defect with repro.

## 6. Recommended additions (priority order)
1. Set the `E2E_UI_EMAIL`/`E2E_UI_PASSWORD` repo secrets (values already known, see
   memory) so `auth-signout.spec.js` actually runs in CI instead of silently
   skipping - `ci.yml` is already wired, just needs the secrets themselves.
2. Interactively re-verify and, if needed, recalibrate the post-login tap
   coordinates in `android-sandhya.sh`/`android-referral.sh` (OS notification
   dialog, tour dismiss, sandhya slots / onboarding form) - the login step is fixed
   and confirmed, the rest is not yet re-verified against the corrected login flow.
3. Get `journey.spec.js`/`journey-female.spec.js` (or a slimmer non-destructive
   subset of their assertions) into CI, even if the full destructive run stays
   manual-only - right now a Sandhyavandhanam UI regression ships silently.
5. Any coverage for `send-reminders`/`send-test-notification` themselves (even a
   thin Deno test of the tz-window logic) - currently the actual push-sending code
   is the least-tested piece of the notification system.
6. Replace or delete the Capacitor-boilerplate Android native stub tests - they
   currently assert against the wrong package name and contribute nothing.
7. Turn `logic-mirrors.test.js`'s SQL side into something that can't silently drift
   (a fixture generated from the live function definitions, refreshed alongside
   migrations) rather than a hand-maintained comment block.

---

Future product ideas (thithi-based observances beyond what's shipped, panchangam
calendar UI) live in [`ROADMAP.md`](ROADMAP.md), out of scope for this document.
