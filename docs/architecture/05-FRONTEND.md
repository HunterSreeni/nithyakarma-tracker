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
| `/learning` | `LearningPage` | Lazy |
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
| `LearningPage` | 133 | Verse-by-verse study, language toggle (Intent 2.1a) |
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
3. **Suppression is centralized.** `if (data.day_complete) suppressTodayNudgesIfScheduled()`
   lives here rather than in the pages, so `TodayPage` and `LearningPage` both get it
   for free.

Sandhyavandhanam sorts to the top of the list.

### Other hooks

| Hook | Lines | Role |
|---|---|---|
| `useNotifications` | 173 | Permission, subscribe/unsubscribe, web + Android transports |
| `useLearning` | 59 | Verse content fetch and `learning_progress` |
| `usePanchangam` | 21 | Today's `panchangam_days` row |
| `useFocusTrap` | 39 | Modal focus containment (a11y) |

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

Three pairs must be changed together. **None has a test asserting the two agree** - a
standing fragility:

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
