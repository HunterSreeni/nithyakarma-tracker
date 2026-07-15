# Nithyakarma Tracker - Test Plan & User-Flow Map

Status: draft v1 (2026-07-11). Covers every user flow, the test type(s) that own
it, UI/UX state checks, and accessibility (WCAG 2.1 AA) checks, across all three
runtime surfaces. Backs the 2-day manual test window.

## Surfaces
| Code | Surface | How tested |
|---|---|---|
| W | Web desktop (Chromium) | Playwright e2e + manual |
| Mw | Mobile web (responsive < 768px) | Playwright (mobile viewport) + manual |
| A | Android native (Capacitor, API 24-36) | adb-driven e2e + manual on emulator/device |

## Test layers
- **Unit** (Vitest + Testing Library) - pure logic (`utils/`), hooks, components in jsdom.
- **Integration** (SQL via Supabase MCP) - RPCs, RLS, triggers, constraints, grants (`supabase/tests/integration-assertions.sql`).
- **E2E** (Playwright web; adb script Android) - full flows against live Supabase.
- **UI/UX** - loading / empty / error / success states, responsiveness, celebration.
- **A11y** - labels, contrast, keyboard, screen reader, focus, touch targets, motion.

Test accounts: `e2e@nithyakarma.test` (preserved UI account, kept until Play Store
prod release), `integtest@nithyakarma.test` (profile-less, for the rolled-back SQL
assertions), and `e2efull@nithyakarma.test` (disposable - the destructive Playwright
journey onboards then deletes it; reseed with `supabase/tests/seed-e2efull.sql`
before each run). See memory.

---

## Android tooling (this dev machine, verified 2026-07-14)

- **Android Studio** runs on Sreeni's desktop session (GUI) - it is not
  filesystem-visible from an agent's sandboxed shell, so an agent can't launch
  it directly. What an agent *can* do: connect to whatever emulator/device is
  already running via `adb`, which talks to a local `adb` server over
  `localhost:5037` regardless of which process (Android Studio's Device
  Manager, or a manually-launched AVD) started the emulator.
- **SDK location**: `~/Android/Sdk` (`$ANDROID_HOME` / `$ANDROID_SDK_ROOT`
  both point here).
  - `adb`: `~/Android/Sdk/platform-tools/adb`
  - `emulator`: `~/Android/Sdk/emulator/emulator`
  - AVDs: `~/.android/avd/` - as of this writing, one exists (`shorts_test`,
    left over from a different project). There is no nithyakarma-specific
    AVD yet; running app builds against whatever emulator is currently up
    works fine regardless of the AVD's name.
- **Build + install a fresh debug build** (from `app/`):
  ```
  npm run build && npx cap sync android
  cd android && ./gradlew assembleDebug
  adb uninstall in.co.sreeniverse.nithyakarma   # clean slate, optional
  adb install app/build/outputs/apk/debug/app-debug.apk
  adb shell am start -n in.co.sreeniverse.nithyakarma/.MainActivity
  ```
  Gradle and a JDK are present in this environment (no Android Studio launch
  needed to build - `./gradlew` alone is sufficient).
- **Driving the UI from an agent (no display server available)**: the
  in-app WebView exposes nothing to `uiautomator` (`NAF="true"` - "not
  accessibility friendly"), so element-lookup tools don't work; interaction
  has to be screenshot-then-tap:
  ```
  adb exec-out screencap -p > screen.png   # inspect, pick a target pixel
  adb shell input tap <x> <y>              # coordinates are native pixels
  adb shell input text "..."               # for text fields (no spaces support well)
  adb shell input keyevent KEYCODE_BACK    # dismiss keyboard/back
  ```
  Screenshots returned by `screencap` are full native resolution (e.g.
  1080x2400) - if a coordinate was read off a *resized/displayed* copy of
  that image, scale it back up to native pixels before tapping, and take a
  fresh screenshot immediately before every tap (any keyboard toggle or
  scroll invalidates previously-read coordinates).
- **Logs**: `adb logcat -d -t <N> | grep -iE "nithyakarma|capacitor|error"` -
  useful filters: `Capacitor` (bridge/plugin calls), `AdMob` (interstitial
  lifecycle), `firebase|fcm|PushNotif` (push registration/delivery),
  `TaskPersister`/`FontLog` noise can be ignored.
- **Manual pre-release gate**: reseed `e2efull@nithyakarma.test` via
  `supabase/tests/seed-e2efull.sql` (Supabase MCP) before each full run,
  since the destructive Playwright journey (and a manual Android pass
  through the same flow) deletes it at the end.

---

## 1. User-flow map (all flows)

1. **Auth** - sign up (email), email verification notice, sign in (email), Google (W/Mw only), invalid creds, min-password, mode toggle, sign out.
2. **Onboarding** - name + gender + optional referral; male → Sandhyavandhanam auto-added; female → not; referral applied (ad-free month).
3. **Today / mark** - list scheduled practices; mark general (Mark Done); celebration → share → (Android) ad; progress ring & streak.
4. **Sandhyavandhanam 3-slot** - Morning/Noon/Evening; 1-2 slots = progressing (streak 0); all 3 = done (streak +1); punya +5/slot.
5. **Add practice** - dropdown, search, already-tracking dimmed; sandhya hidden for female / no-upanayanam subjects.
6. **Cadences** - daily, daily_count (108), weekly (weekday only, no off-day streak break), sequence (position increments, cycles).
7. **History** - past logs grouped by date; sandhya shown as x/3.
8. **Sabha / leaderboard** - Week/Month/Friends/Kids tabs; own row pinned & highlighted; Hall of the Week/Month; opt-out hides you from others but not yourself.
9. **Bala Sabha (kids)** - family-member profiles, first name only, parent opt-in.
10. **Profile switcher** - track self vs each family member.
11. **Profile** - edit name; tier progress bar; stats (streak/best/punya); referral share; leaderboard opt-out; notifications toggle; sign out.
12. **Family members** - add (name, gender, upanayanam toggle, Bala Sabha opt-in); boys+upanayanam auto-get sandhya; remove (cascades logs).
13. **Notifications** - enable/disable; web push (VAPID) + Android FCM; local reminders; timezone windows (9:00/12:30/18:30/20:00); per-slot dedup; token rotation; on-demand "Send test notification"; self-heal on mount; permission-revoked guidance.
14. **Referrals** - apply code at signup; both parties +30 ad-free days; self/invalid rejected.
15. **Delete account** - type-your-email confirm → `delete_account()` RPC removes auth user + cascade.
16. **Streaks & tiers** - per-practice + overall streak continuity/reset; tiers Shishya→Sadhaka→Yogi→Rishi→Brahmarishi.
17. **Ads** - Android interstitial after celebration; skipped when ad-free; none on web.
18. **Resilience** - offline / network error / expired session / stale profile.

---

## 2. Flow-by-flow test matrix

Legend: ✅ exists · ⬜ to add.

### Auth
| Case | Layer | Status |
|---|---|---|
| Google + email offered on web; hidden on native | Unit (AuthPage) | ✅ |
| Email/password sign in calls signInEmail | Unit | ✅ |
| Signup switches + verification notice (no session) | Unit | ✅ |
| Invalid credentials shows server error | Unit + E2E(W) | ✅ |
| Password minLength blocks submit | E2E(W) | ✅ |
| Mode toggle login↔signup | E2E(W) | ✅ |
| Sign out returns to auth | E2E(W) | ✅ (`e2e/auth-signout.spec.js`) |
| Google native return (deep link) | E2E(A) | ⬜ (feature not wired; test the hidden state) ✅ |

### Onboarding
| Male → Sandhyavandhanam auto-added | Integration + E2E(W) | ✅ |
| Female → no Sandhyavandhanam | Integration (trigger) | ✅ |
| Sandhya trigger blocks female / boy-no-upanayanam | Integration | ✅ |
| Referral code applied at signup (self/invalid rejected) | Integration | ✅ / E2E ✅ (`e2e/referral.spec.js`; also fixed a real crash - `apply_referral(...).catch()` isn't valid on the rpc() builder, useAuth.jsx:86) |

### Today / mark & Sandhya 3-slot  ← the reported area
| Mark general practice → streak 1, celebration | E2E(W) | ✅ |
| **Sandhya 1 slot → streak 0, "progressing", 1/3** | Unit(cadence) + Integration(RPC) + E2E(W) | ✅ |
| **Sandhya 3 slots → done, streak 1, punya 15** | Integration(RPC) + E2E(W) | ✅ / E2E(A) ✅ (`e2e/android-sandhya.sh`) |
| isDoneToday: sandhya needs all 3; general needs 1 | Unit | ✅ |
| Duplicate same-slot rejected | Integration | ✅ |
| Progress ring & doneCount reflect partial sandhya | Unit(TodayPage) | ✅ |
| Celebration only from verified RPC response | Unit | ✅ |
| Streak continuity (day N→N+1) and reset (gap) | Integration | ✅ (per-practice) |

### Add practice / cadences
| Sandhya hidden for female/no-upanayanam in dropdown | Unit(TodayPage) | ✅ |
| Already-tracking dimmed & disabled | E2E(W) | ✅ |
| Weekly scheduled only on weekday; no off-day break | Unit(cadence) + Integration | ✅ |
| daily_count target passed as count | Integration | ✅ |
| Sequence position increments & cycles | Integration | ✅ |

### Leaderboard / Sabha
| Own row pinned + "(You)" | E2E(W) | ✅ |
| Kids tab separate (Bala Sabha) | E2E(W) | ✅ |
| Opt-out hides from others, self still sees own row | Integration + E2E(W) | ✅ |
| Score = completed practice-days (sandhya once/3) | Integration | ✅ |

### Profile / family / referrals / delete
| Edit name persists | E2E(W) | ✅ |
| Add family member (girl, Bala Sabha) appears | E2E(W) | ✅ |
| Boy+upanayanam gets sandhya | Integration | ✅ |
| Remove family member cascades logs | Integration | ✅ |
| Tier boundaries match client mirror | Integration | ✅ |
| delete_account removes auth user (not just profile) | Integration | ✅ |
| Delete flow returns to auth | E2E(W) | ✅ |

### Notifications
| Toggle enables + saves pref (web) | E2E(W) | ✅ |
| Unsupported browser handled | Unit | ✅ |
| Native: schedule reminders + FCM register | Unit | ✅ |
| Rotated FCM token re-saved | Unit | ✅ |
| 'reminders' channel created | Unit | ✅ |
| Delivery dedup unique constraint | Integration | ✅ |
| Edge fn sends only in tz window (live) | Integration/manual | ✅ (verified) |
| Permission denied blocks toggle-on with guidance, DB untouched (web + Android) | Unit | ✅ |
| Self-heal on mount: re-subscribes silently if enabled+granted+subscription lost; shows guidance if enabled+denied (web + Android) | Unit | ✅ |
| "Send test notification" button sends via `send-test-notification` edge fn and reports device count / no-subscription error | Unit | ✅ |
| **Manual round-trip:** toggle off → on → click "Send test notification" → confirm a real push arrives immediately (no waiting for a scheduled window) | Manual | ✅ (A + W, 2026-07-14) |
| **Manual (W + A):** revoke notification permission in browser/OS settings, confirm the app shows blocked guidance and cannot silently claim success; re-grant permission and confirm the checkbox/test button work again without a full reload (web, via the Permissions API listener) | Manual | ✅ (A + W, 2026-07-14) |

---

## 3. UI/UX state tests (per screen)
- **States:** loading spinner, empty ("Add your first anushtanam"), error banner, success/celebration, disabled/busy buttons.
- **Responsive:** auth two-panel ≥768px / stacked <768px; Today 1-col mobile / navbar web; no horizontal scroll at 320/375/414/768/1024/1440.
- **Celebration modal:** shows only from verified response; confetti/flame; share card; Continue; Android ad-on-close; Esc closes.
- **Profile switcher:** active chip highlighted; switching reloads subject.
- **Visual regression (optional):** Playwright screenshots of auth, today, celebration, sabha, profile at desktop+mobile.

## 4. Accessibility (WCAG 2.1 AA)
| Check | Where | Status |
|---|---|---|
| All inputs have associated `<label>` (htmlFor/id) | auth, profile, family, add | partial - audit |
| Buttons have discernible text / aria-label (icon-only: slot buttons, info icon, nav) | Today, nav, switcher | ✅ (audit found most already compliant; added `aria-label` to the `top-avatar` profile link, the one real gap) |
| Images have alt (Periyava, share card) | auth, celebration | ✅ (Periyava already had `alt`; the "share card" is styled markup, not an `<img>` - nothing to add) |
| Color contrast AA (4.5:1 text): saffron-on-white, new light-saffron hero text, muted #8a7f70, tier badges | global | ✅ (saffron-on-white/`--text-2`/tier badges already passed; fixed the real failures - gradient text on the auth hero/share card/hall banner, `.nav-item`, `.auth-or`/`.app-version`, `.dz-sub` - locked in via `contrast.test.js`) |
| Keyboard: full tab order, visible focus ring, Enter submits, Esc closes modal | all | ✅ (restored a visible focus ring on `.field-input`/`.dd-search`; wrapped ProfilePage's edit-name/add-family/delete-confirm in `<form>` so Enter submits; added Escape-to-close to the add-practice dropdown) |
| Focus trap + return focus in celebration/onboarding modals | modals | ✅ (new `useFocusTrap` hook, wired into CelebrationModal and the add-practice dropdown; GuidedTour is out of scope - third-party driver.js-managed overlay) |
| Heading hierarchy (h1→h2…), landmarks (main/nav) | all pages | ✅ (added `<h1>`/`<h2>` to Auth/Onboarding/Today/History/Sabha/Profile, which previously used zero semantic headings; labeled the two `<nav>` landmarks in Layout.jsx) |
| Form errors announced (aria-live / role=alert on .auth-error) | auth | ✅ (`role="alert"` added to `ErrorBanner` and all 8 inline `.auth-error` occurrences) |
| Touch targets ≥44×44 (sandhya slot buttons, nav items, chips) | mobile | ✅ (`.slot-btn`/`.ps-chip`/`.radio-chip`/`.seg` bumped to `min-height:44px`; `.info-btn`/`.top-avatar` keep their visual size, hit area expanded via an invisible `::after`) |
| `prefers-reduced-motion` respected (confetti, spinners, pulse) | celebration | ✅ (audit found no actual CSS animation exists yet - confetti/spinner/pulse are static text; added the global reduced-motion rule proactively so future motion inherits it) |
| Android TalkBack pass; web NVDA/VoiceOver spot check | A / W | ⬜ manual (unchanged - needs a real device/screen-reader pass, not automatable) |
| Automated a11y scan (axe-core, jsdom) - AuthPage, Terms, Privacy, TodayPage (inside real Layout, `region` rule enabled), CelebrationModal | Unit | ✅ (no serious/critical; corrected this row - GuidedTour was never actually covered despite the prior claim, and still isn't, since it's a third-party overlay with low test value) |

## 5. 2-day manual test window (starts 2026-07-11)
Daily, on web + Android emulator, signed in as e2e (male) and a female profile:
- Day 1: auth, onboarding (M/F), add each cadence type, mark 1 sandhya slot (expect 1/3 + streak 0), mark all 3 (expect done + streak 1), general practice, history, celebration+share, notifications enable, leaderboard, profile edit, add/remove family, referral apply.
- Overnight: confirm reminder fires in a tz window; confirm streak persists to Day 2.
- Day 2: mark again (expect streak 2 / continuity), miss a day scenario (reset), opt-out, delete-account (on a throwaway, not e2e), T&C/privacy reachable.
- Track results in this doc's checklist; file any defect with repro.

## 6. Tooling to add
- `axe-core` + `@axe-core/playwright` for automated a11y.
- Playwright projects for desktop + mobile viewports.
- adb e2e helper extended for the sandhya 3-slot native flow.
- Coverage report (`vitest --coverage`).

---

Future product ideas (thithi-based observances, panchangam calendar) live in
[`ROADMAP.md`](ROADMAP.md), out of scope for the current release.
