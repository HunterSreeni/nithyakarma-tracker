# 05 - Frontend

React 19.2 + Vite 8.1, plain JavaScript/JSX. No TypeScript. 1,836 lines of component
code across 19 components, 6 hooks and 15 utils.

## Routing and the auth gate

`src/App.jsx` wraps everything in `BrowserRouter` → `AuthProvider` → `Gate`.
`Gate` resolves in this order, and the order matters:

1. **Loading** - shows a spinner, plus a 15-second watchdog that offers a Reload button
   if `useAuth` ever hangs
2. **Standalone pages** - `/terms`, `/privacy`, `/about`, `/karma` render *before* any
   session check, so they are reachable signed out. Play Store requires a publicly
   reachable privacy policy
3. **`/reset`** - reachable during a recovery session so password reset is not skipped
   past into the app
4. **No session** → `AuthPage`
5. **Session but no profile** → `Onboarding`
6. Otherwise → `Layout` wrapping the app routes

| Route | Component | Loading |
|---|---|---|
| `/` | `TodayPage` | Eager |
| `/learning` | `LearningHub` - lists every practice with Learning content | Lazy |
| `/learning/:slug` | `LearningPage` - the reader for one practice | Lazy |
| `/history` | `HistoryPage` | Lazy |
| `/sabha` | `SabhaPage` | Lazy |
| `/referrals` | `ReferralsPage` | Lazy |
| `/profile` | `ProfilePage` | Lazy |
| `/terms`, `/privacy` | `LegalPages` | Lazy, signed-out reachable |
| `/about`, `/karma` | `InfoPages` | Lazy, signed-out reachable |
| `/reset` | `ResetPassword` | Lazy |
| `*` | Redirect to `/` | |

Only `TodayPage` is in the initial bundle. Everything else code-splits, which addresses
the 553 KB single-bundle warning (B5).

---

## Components

| Component | Lines | Role |
|---|---|---|
| `TodayPage` | 288 | The core screen: today's practices, marking, suggestions |
| `ProfilePage` | 226 | Identity, tier progress, settings, version, delete account |
| `LegalPages` | 149 | `TermsPage` + `PrivacyPage` |
| `LearningPage` | ~75 | Reading reference for one practice - language toggle, YouTube link. No completion tracking of its own (reworked 2026-07-20 - see below) |
| `LearningHub` | ~20 | Lists every practice with Learning content, links to `/learning/:slug` |
| `InfoPages` | 125 | `AboutPage` + `KarmaPage` |
| `SabhaPage` | 122 | Leaderboards - global, friends, kids |
| `AuthPage` | 120 | Sign in/up, Google OAuth, password reset entry |
| `Onboarding` | 96 | Value-prop intro then the profile form |
| `HistoryPage` | 85 | Past logs |
| `ReferralsPage` | 81 | Referral code, WhatsApp share, referred list |
| `GuidedTour` | 74 | driver.js first-run tour |
| `CelebrationModal` | 73 | Post-save reward moment |
| `Turnstile` | 60 | Cloudflare captcha on auth |
| `Layout` | 58 | Topbar + bottom nav |
| `ResetPassword` | 49 | Set-new-password form |
| `NotificationSettings` | 35 | Push opt-in, test notification |
| `PanchangamBox` | 26 | Today's panchangam summary |
| `ProfileSwitcher` | 25 | Switch between self and children |
| `ErrorBanner` | 11 | Shared error surface |

---

## Hooks

### `useAuth` (185 lines) - `hooks/useAuth.jsx`

Context provider for `session`, `profile`, `loading`. Handles email/password, Google
OAuth, and on native the `appUrlOpen` deep-link callback that completes the OAuth
session. Exposes `NATIVE_OAUTH_REDIRECT` for the custom URL scheme.

### `useToday` (69 lines) - the central write path

Loads the selected subject's scheduled practices plus today's logs, and owns `submit()`.

Three properties worth preserving in any refactor:

1. **Local date everywhere.** Both the log query and the RPC call use
   `localDateString()`, so the client and server agree on "today" across timezones.
2. **Verified save only.** `submit()` throws unless `data.saved` is true. Callers show
   the celebration and fire the ad *only* from this return value - never optimistically.
   This is what guarantees "no ad on a failed save".
3. **Celebration is gated on a real streak.** Callers only show `CelebrationModal` when
   `data.day_complete && data.overall_streak >= 1` - fixed 2026-07-20, it used to fire on
   every successful submit including partial marks and 0-streak completions.
4. **Suppression is centralized.** `if (data.day_complete) suppressTodayNudgesIfScheduled()`
   lives here rather than in the pages, so every caller of `useToday` gets it for free.
   As of 2026-07-20, `LearningPage` is no longer one of those callers - it's pure reading,
   with no `submit()` call of its own; completion happens from `TodayPage` like any other
   practice.

Sandhyavandhanam sorts to the top of the list.

### Other hooks

| Hook | Lines | Role |
|---|---|---|
| `useNotifications` | 173 | Permission, subscribe/unsubscribe, web + Android transports |
| `useLearning` | ~55 | Verse content fetch only (stale-while-revalidate). No longer tracks `learning_progress` - reading is decoupled from completion as of 2026-07-20 |
| `usePanchangam` | 21 | Today's `panchangam_days` row |
| `useFocusTrap` | 39 | Modal focus containment (a11y) |

### Learning content sourcing convention

`app/scripts/content/*.json` files (e.g. `hanuman-chalisa.json`,
`vishnu-sahasranamam.json`) have a per-language field for each verse (`english`,
`malayalam`, `tamil`, `sanskrit`, etc.).

**Each field must be the actual verses as genuinely published and practiced in that
language/script by real communities - sourced from real references, never a
mechanical transliteration or translation generated from the Sanskrit.** Real
published Malayalam and Tamil editions of these stotras already exist and are widely
printed; the job is finding and using those genuine sources, not computationally
deriving a script rendering from the Sanskrit. A self-generated transliteration is
not the same thing as how the text is actually published and read in that language,
even if phonetically similar. This applies to every language field, including
`english` (should be an established transliteration convention, not an ad hoc one)
and retroactively to already-shipped content - don't assume an existing field is
correct sourcing just because it shipped.

Content of this kind should also be flagged for a human accuracy review (someone
fluent, a priest, or a family elder) before being treated as production-final - this
is sacred text, and sourcing method alone doesn't substitute for that pass.

---

## Utils

| Util | Key exports | Notes |
|---|---|---|
| `cadence.js` | `isScheduled`, `isDoneToday`, `localDateString`, `SANDHYA_SLOTS`, `cadenceLabel` | **Client mirror of the SQL `is_scheduled`** |
| `tiers.js` | `TIERS`, `tierFor`, `tierProgress`, `tierClass` | **Client mirror of SQL `tier_for`** |
| `notifications.js` | `scheduleAllReminders`, `cancelAllReminders`, `suppressTodayNudgesIfScheduled` | Local (on-device) notifications |
| `webPush.js` | `isPushSupported`, `setupWebPush`, `hasActiveSubscription` | VAPID web push |
| `pushAndroid.js` | `registerFCM`, `unregisterFCM`, `checkFCMPermission` | FCM + foreground listener |
| `ads.js` | `adsAvailable`, `isAdFree`, `showInterstitial`, `_resetAdSession` | Session frequency cap |
| `analytics.js` | `track` | Writes to `analytics_events`, no PII |
| `share.js` | `shareText`, `shareUrl`, `shareToWhatsApp` | Referral growth path |
| `review.js` | `isMilestone`, `maybeRequestReview` | Rate-limited in-app review |
| `haptics.js` | `celebrationHaptic` | Intent 2.2 |
| `panchangamScript.js` | `TAMIL_MONTH_SCRIPT`, `MALAYALAM_MONTH_SCRIPT` | **Month names only** today |
| `practiceIcons.jsx` | `PRACTICE_ICONS`, `PracticeIcon` | Custom SVGs: Lotus, Chakra, Trident, JapaMala, Mace |
| `contrast.js` | `contrastRatio` | Backs the WCAG a11y assertions |
| `friendlyError.js` | `friendlyError` | Postgres errors to human copy |
| `sentry.js` | `initSentry` | |

### Logic mirrored between client and server

Three pairs must be changed together. `utils/__tests__/logic-mirrors.test.js` pins all
three against the actual Postgres source (added 2026-07-19 alongside the B13 fix - see
[09-STATUS-LEDGER.md](09-STATUS-LEDGER.md)), closing what used to be a standing
fragility with no test coverage:

| Client | Server |
|---|---|
| `utils/cadence.js` `isScheduled()` | SQL `is_scheduled()` |
| `utils/tiers.js` `tierFor()` / `TIERS` | SQL `tier_for()` / `freeze_cap_for()` |
| `utils/cadence.js` `isDoneToday()` | The day-completion `bool_and` in `submit_practice_log` |

> `panchangamScript.js` covers **month names only**. Thithi names, all 27 nakshatras, and
> the kalam labels have no native-script mapping yet - that is the gap the Malayalam
> label work fills.

---

## Supabase client

`src/lib/supabase.js` - a single `createClient` instance from `VITE_SUPABASE_URL` and
`VITE_SUPABASE_KEY`. Import this everywhere; never construct another client.

## Testing

27 test files under `__tests__/` directories alongside the code, run by Vitest with
Testing Library. `components/__tests__/a11y.test.jsx` runs axe-core including the
contrast assertions from Intent 0.4. Playwright e2e specs live in `app/e2e/`.

The destructive journey (`@destructive`, account `e2efull`) is excluded from CI because
`delete_account` removes the auth user, making it non-repeatable. It is a manual
pre-release gate.

## Related

- Server-side counterparts: [02-RPCS.md](02-RPCS.md)
- Push detail: [07-NOTIFICATIONS.md](07-NOTIFICATIONS.md)
