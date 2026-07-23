# 09 - Status Ledger

Every Intent from `docs/UPGRADE-PLAN.md` and `docs/ROADMAP.md`, with a status **verified
against code, migrations or the live database** - not copied from the checkboxes in those
documents.

Audited 18 July 2026 against app version `0.15.4`. Revised 19 July 2026 after a full
device and web test pass (see "19 July verification pass" below). Revised again
20 July 2026 - see "20 July additions" below for the marketing site, support email
cutover, and the B13 streak-freeze fix.

Legend: ✅ Done · 🟡 Partial · ⬜ Open · ❌ Blocked

---

## Launch blockers (Phase 0)

| Intent | Status | Evidence |
|---|---|---|
| 0.1 Real launcher/adaptive icon | ⬜ **Open** | `mipmap-*/ic_launcher.png` is still the **stock Capacitor blue-X placeholder** - files dated 19 June 2026, predating the project (created 7 July). Visually confirmed |
| 0.2 Production AdMob | ✅ **Done** | Real app ID in `AndroidManifest.xml:16` (`ca-app-pub-2677287550445019~...`) and real interstitial unit in `utils/ads.js`, `isTesting` gated on `import.meta.env.DEV`. G content rating + Dating/Gambling/Alcohol/etc. blocked in the AdMob console (23 July 2026) |
| 0.3 Password reset | ✅ Done | `components/ResetPassword.jsx`, `/reset` route in `App.jsx:56`, tests present |
| 0.4 Accessibility pass | ✅ Done | `utils/contrast.js`, `components/__tests__/a11y.test.jsx` with contrast assertions |
| 0.5 Store readiness assets | 🟡 Partial | `docs/PLAY-STORE-LISTING.md` drafted, screenshots captured (commit `4c7a74f`), privacy policy live. Missing: feature graphic, signing keystore, content rating |
| 0.6 Onboarding value-prop | ✅ Done | `Onboarding.jsx:12` `useState('intro')`, intro step at `:34`, advances to form |
| 0.7 Password policy | 🟡 Partial | Client `minLength={8}` at `AuthPage.jsx:81`. **HIBP still disabled** server-side - Supabase Pro feature, noted won't-fix |

> ### ⚠️ One launch blocker left: the app icon
>
> AdMob is done (23 July 2026). **The app icon is still the default placeholder** -
> shipping a blue-X launcher icon to Play is a visible quality problem and hurts
> install conversion badly.

---

## Release engineering (Phase R)

| Intent | Status | Evidence |
|---|---|---|
| R1 CI pipeline | ✅ Done | `.github/workflows/ci.yml` |
| R2 release-please | ✅ Done | `.github/workflows/release-please.yml`, `release-please-config.json`, releases cut through `0.15.4` |
| R3 Version in app | ✅ Done | `src/version.js`, `src/__tests__/version.test.js` |
| R4 Close schema drift | ✅ **Done** | 31 local migrations = 31 remote, names match 1:1. **`UPGRADE-PLAN.md` still describes this as open** |

> R4's plan text says the reconstruction files are "still untracked locally, not
> committed to git". That is no longer true - all four are committed. See
> [04-MIGRATIONS.md](04-MIGRATIONS.md) for the one remaining caveat (10 migrations have
> differing timestamp prefixes, same relative order, cosmetic only).

---

## Retention and growth (Phase 1)

| Intent | Status | Evidence |
|---|---|---|
| 1.1 Streak freeze | ✅ Done | `freeze_credits` on both subject tables, `freeze_cap_for`, `streak_after_completion`, migration `20260712094627` |
| 1.2 Streak-miss reminder | ✅ **Done** | Server nudges (`send-reminders`), client suppression (`suppressTodayNudgesIfScheduled`). `nudge_morning` confirmed delivering 2026-07-19; on-device push verified end to end on the emulator |
| 1.3 Analytics + crash | ✅ Done | `analytics_events` table (209 rows), `utils/analytics.js`. `utils/sentry.js` wired, `VITE_SENTRY_DSN` set on Netlify production (23 July 2026), CSP `connect-src` allows the ingest domain |

> `utils/sentry.js` sets `sendDefaultPii: false`, which `@sentry/react` deprecated as of
> SDK 10.57 (installed: 10.65) in favour of a `dataCollection` option. Still functional -
> deprecated, not removed - but will break on a future v11 upgrade. Not fixed yet, flagged
> 23 July 2026.
| 1.4 In-app review | ✅ Done | `utils/review.js` with `isMilestone` + rate limiting |
| 1.5a Women's scope decision | ✅ Done | Decided narrow, 17 July 2026 |
| 1.5 Female activation default | ✅ Done | `SuggestedPractices` in `TodayPage.jsx`, `TodayPage.test.jsx` covers the female/non-sandhya case |
| 1.6 Finish or hide Friends tab | ✅ Done (hidden) | `SabhaPage.jsx:11-13` exposes only Week / Month / Kids. The `friends` scope still exists in `get_leaderboard` and works - it is simply not surfaced |
| 1.7 Native Google Sign-In | ✅ Done | `useAuth.jsx:10` `NATIVE_OAUTH_REDIRECT`, manifest intent-filter, `appUrlOpen` handling, tests |

---

## Depth and premium (Phase 2)

| Intent | Status | Evidence |
|---|---|---|
| 2.1 Karaoke lyrics + AV (premium) | ⬜ Open | Not started. The paid layer does not exist |
| 2.1a Learning page pilot | ✅ Done | `LearningPage.jsx`, `useLearning.js`, `learning_progress` table (4 rows), lazy-loaded route |
| 2.2 Rewarding celebration | 🟡 Partial | `utils/haptics.js` + modal animation shipped (commits `b60a03f`, `dd4504e`). **Sound not implemented** |
| 2.3 Palette coherence | ✅ Done | Commit `dd4504e` recolored topbar and referral card to saffron |
| 2.4 Sandhya-time-aware reminders | ⬜ Open | Deferred post-Phase-A. Windows are still hardcoded; `profiles.reminder_times` exists but is **not read** by the edge function |
| 2.5 Tier + referral perk ladder | ⬜ Open | Freezes only (from 1.1). No ad-free-day or discount ladder |
| 2.6 Ad-free upgrade (₹99/yr) | ⬜ Open | No Play Billing. `ad_free_until` column exists and is referral-driven, ready to plug into |
| 2.7 Today panchangam box | ✅ Done | `PanchangamBox.jsx`, `usePanchangam.js`, `panchangam_days` (365 rows), `generate-panchangam.cjs`. Native-script month names shipped (`502dd3e`) |

### Roadmap (not yet Intents)

| Item | Status |
|---|---|
| Thithi-based observances | ⬜ Open - `practices.cadence` CHECK has no `thithi` value; `is_scheduled` has no thithi branch |
| Panchangam calendar view | ⬜ Open - only the single-day box exists |
| Temple visit tracking | ⬜ Open - deferred to a later phase by decision, 18 July 2026 |

---

## Security findings (16 July 2026 analysis)

| ID | Finding | Status | Evidence |
|---|---|---|---|
| S1 | Secrets committed to git | ✅ Rotated | VAPID + cron secret rotated July 2026. Values remain in git history |
| S2 | Firebase admin key in tree | ✅ Fixed | Moved to `~/.secrets/` |
| S3 | `apply_referral` farmable | 🟡 Mitigated | 5-per-24h cap (`20260716144330`). A patient attacker still compounds |
| S4 | Leaderboard opt-out default | ✅ Fixed | `leaderboard_opt_in` default `false` (`20260716144249`) |
| S5 | `tier_for` mutable search_path | ✅ Fixed | `20260716144213` |
| S6 | HIBP disabled, min length 6 | 🟡 Partial | Client raised to 8. HIBP still off (Pro-only, won't-fix). Reconfirmed via live Supabase advisors 2026-07-20 - `auth_leaked_password_protection` still WARN, unchanged |
| S7 | No security headers | ✅ Fixed | `app/netlify.toml` has CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy |
| S8 | `allowBackup="true"` | ✅ Fixed | Now `false`; `POST_NOTIFICATIONS` declared |
| S9 | `app_config` RLS with no policy | ✅ Intentional | Service-role only by grant |

## Code bugs

| ID | Bug | Status | Evidence |
|---|---|---|---|
| B1 | Timezone mismatch on submit | ✅ Fixed | `p_local_date` with ±1 day clamp (`20260716144405`) |
| B2 | Schema drift | ✅ Fixed | See R4 |
| B3 | Unused `PartyPopper` import | ✅ Fixed | Not present in current `TodayPage.jsx` |
| B4 | Zero-score leaderboard rows | ✅ Fixed | `20260716151620` |
| B5 | 553 KB single bundle | ✅ Fixed | `App.jsx` lazy-loads every route except Today |
| B6 | Foreground push dropped | ✅ Fixed | `pushAndroid.js:50` `pushNotificationReceived` listener |
| B7 | Empty-state flash on load | ⬜ **Unverified** | Not re-checked in this audit |
| B8 | `Asia/Calcutta` alias | ✅ Fixed | `20260716151502` |

---

## New findings from this audit

### ✅ B9 - The 08:00 morning nudge had never been sent (fixed 2026-07-18)

`send-reminders/index.ts:45` emits slot name `nudge_morning`, but the
`notification_deliveries.slot` CHECK only permitted
`morning`, `afternoon`, `evening`, `nudge`. The pre-send insert failed the constraint,
and `if (dupErr) continue;` misread that failure as "already sent" and skipped the user.

**Production evidence:** `afternoon` 13 rows, `evening` 17, `morning` 14, `nudge` 15 -
and **zero `nudge_morning` rows, ever**. The four working slots mapped exactly to their
IST windows; the 08:00 window (02:30 UTC) was entirely absent.

**Fixed by:**
1. Migration `20260718170117_notification_deliveries_nudge_morning_slot` - added
   `nudge_morning` to the CHECK. **Applied to production**, so the already-deployed
   function started delivering at the next 08:00 window.
2. `send-reminders/index.ts` - the catch now treats only Postgres `23505` (unique
   violation) as a duplicate; anything else logs. **Requires an edge-function deploy
   to take effect.**

Intent 1.2 remains Partial only on its outstanding on-device manual check.

### 🟠 B10 - App icon is still the Capacitor placeholder

See Intent 0.1 above. A second launch blocker alongside AdMob.

### 🟡 Client/server logic mirrors have no agreement tests

Three pairs must be edited together, and nothing catches a divergence:

| Client | Server |
|---|---|
| `utils/cadence.js` `isScheduled()` | SQL `is_scheduled()` |
| `utils/tiers.js` `tierFor()` / `TIERS` | SQL `tier_for()` / `freeze_cap_for()` |
| `utils/cadence.js` `isDoneToday()` | Day-completion `bool_and` in `submit_practice_log` |

Adding thithi cadence means touching the first pair on both sides - a good moment to add
the test.

### 🟡 Bala Sabha has never been used

`family_members` has **0 rows in production**. The feature described as a key
differentiator has no real-world usage. Worth a usability pass before marketing it.

### 🟡 Two `netlify.toml` files with different headers

Root sets `base = "app"` and has **no headers block**; `app/netlify.toml` carries the real
CSP and HSTS. Any change to the deploy topology risks silently dropping the security
headers.

---

## 19 July verification pass

A full test pass on the Android emulator and the live Netlify deploy, after the
appId rename and Firebase/OAuth re-registration.

### Verified working

| Check | Evidence |
|---|---|
| Google sign-in under the new appId | Real sign-in on device; proves the new OAuth web client and the `org.nithyakarma.app://auth-callback` allow-list entry |
| FCM registration under the new Firebase app | 142-char token in `push_subscriptions`, `platform='android'` |
| Push delivered end to end | Test notification arrived; `id=600` = `FOREGROUND_PUSH_ID`, so the B6 foreground listener fired too |
| `nudge_morning` delivering | First real rows ever written for that slot |
| Practice log + streak | `morning` slot persisted, UI updated |
| Sreeniverse removal | `/terms` and `/privacy` show only the contact email; `/about`, `/karma` clean |
| Security headers | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy all live |

### ✅ B11 - Webfonts were blocked by our own CSP (fixed 2026-07-19)

`src/index.css` imported Sora and DM Sans from `fonts.googleapis.com`, but
`app/netlify.toml` pins `style-src` and `font-src` to `'self'`. Production blocked the
stylesheet and **every page rendered in the system sans fallback**. Measured against
the live deploy: `document.fonts.size === 0`, one CSP violation in console.

Fixed by self-hosting into `app/public/fonts/` (commit `ca49fa6`). Google serves these
as **variable** fonts, so the 20 URLs its CSS lists are only 6 distinct files - shipped
as 6 with `font-weight` ranges, ~150KB instead of ~430KB.

Android was never affected: the CSP is a Netlify response header and the WebView loads
from local assets. **That asymmetry is the lesson** - a CSP regression is invisible on
device and only shows up on the web.

### ✅ B12 - Capacitor logged OAuth tokens to logcat (fixed 2026-07-19)

Default `loggingBehavior` echoed the full `appUrlOpen` callback - `access_token`,
`refresh_token`, Google `provider_token` - in cleartext on debuggable builds. Fixed by
`loggingBehavior: 'none'` (commit `0e87021`). Release builds were never affected. The
leaked refresh token was revoked by signing out and confirmed dead
(`refresh_token_not_found`).

### ⚠️ Near-miss worth remembering

The 2026-07-19 edge-function deploy briefly shipped `verify_jwt: true` (version 8),
which would have silently killed **all** push. See
[03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md) for why and how to avoid it.

---

## Database advisory findings (Supabase linter, 20 July 2026)

Live security + performance advisors pulled via `mcp__supabase__get_advisors`. Severity
scale: Info / Low / Medium / High / Severe.

| ID | Finding | Severity | Status | Notes |
|---|---|---|---|---|
| D1 | `auth_leaked_password_protection` disabled | Medium | 🟡 Won't-fix (Pro-only) | Same as **S6** above. Client `minLength={8}` partially mitigates. Reconfirmed live 2026-07-20 |
| D2 | `app_config` RLS enabled, no policy | Info | ✅ Intentional | Same as **S9** above - service-role only by grant, by design |
| D3 | 5 `SECURITY DEFINER` RPCs callable by `authenticated` | Info | ✅ Reviewed, no action | Generic advisory; none of the 5 (`apply_referral`, `delete_account`, `get_leaderboard`, `get_my_referrals`, `submit_practice_log`) take a target-user-id parameter, so no IDOR path exists |
| D4 | Unindexed FK: `learning_progress.family_member_id` | Low | ⬜ Open, deferred | Purely additive fix (new index), zero behavior risk. Not yet applied - low urgency at current row counts |
| D5 | 4 RLS policies re-evaluate `auth.uid()` per row instead of `(select auth.uid())` | Low | ⬜ Open, deferred | Tables: `analytics_events`, `learning_progress` (×3 policies). Query-planner rewrite only, semantically identical access control - safe whenever picked up |
| D6 | 3 unused indexes (`idx_practice_logs_owner`, `idx_user_practices_family_member`, `idx_user_practices_practice`) | Info | ⬜ No action planned | No measurable benefit at current row counts (single/double/triple digits per table); revisit post-launch if usage patterns confirm they're truly dead |

None of D4-D6 change query results or RLS access semantics - D4 and D5 are safe,
low-priority performance fixes; D6 is genuinely optional at this data volume.

---

## 20 July additions

### ✅ B13 - A single Learning-page log could permanently freeze the day/streak (fixed 2026-07-20)

`LearningPage` submits with `p_award_streak = false`, so `hanuman-chalisa` logs write
`counts_toward_streak = false`. But marking a verse also calls `addPractice`, creating a
permanent `user_practices` row with `cadence = 'daily'`. That row then joined the
day-completion `bool_and` every day going forward, on a branch (`counts_toward_streak`)
its own logs could never satisfy - so once a user marked a single verse, their day could
never complete again and the overall streak froze. The UI's `isDoneToday` doesn't filter
`counts_toward_streak`, so `TodayPage` cheerfully showed the day as done while the streak
silently stopped advancing underneath. Production user `e9fdea69` was in exactly this
state.

**Fixed by:** `practices.affects_streak` (default `true`, `false` for `hanuman-chalisa`)
plus `and p2.affects_streak` in the day-completion query, migration
`20260719060618_practices_affects_streak`. See [01-DATABASE.md](01-DATABASE.md) and
[02-RPCS.md](02-RPCS.md). Client-side, `countsTowardDayCompletion()` in `utils/cadence.js`
mirrors the same rule. New test: `utils/__tests__/logic-mirrors.test.js`, pinning all
three client/server pairs (`isScheduled`/`is_scheduled`, `tierFor`/`tier_for`,
`isDoneToday` vs the day-completion `bool_and`) against the Postgres source directly -
closes the "no agreement tests" gap noted above for at least these three.

### Marketing site and support email

- `support@nithyakarma.org` is live both directions (Cloudflare Email Routing in, Gmail's
  own SMTP + App Password out - no third-party relay). Replaces
  `support@sreeniverse.co.in` in `LegalPages.jsx`.
- A static (non-SPA) marketing site was built at `/site` for `nithyakarma.org`, deployed
  22 July 2026 to its own Netlify project (`https://tranquil-jalebi-88d0eb.netlify.app/`),
  custom domain live 23 July 2026, Cloudflare Web Analytics enabled (automatic RUM). See
  [11-MARKETING-SITE.md](11-MARKETING-SITE.md).
- `app.nithyakarma.org` also went live 23 July 2026 - Cloudflare CNAME to
  `nithykarma.netlify.app`, added as an additional Netlify custom domain (the original
  origin was kept alive, not replaced or redirected). Supabase Auth redirect allow-list
  updated, `push.ts`'s `APP_URL` updated and `send-reminders` / `send-test-notification`
  redeployed. CSP `connect-src` needed no change (never hardcoded the app's own origin).
- **Release status unchanged: still not released anywhere.** No Play Store listing, no
  App Store/iOS platform. Android testing-track release planned for the week of
  2026-07-27; iOS is Phase 3, not started. See `docs/ROADMAP.md`'s "Release status" callout.

---

## Corrections owed to the planning docs

`docs/UPGRADE-PLAN.md` should be updated to reflect:

1. **R4** - drift is closed; the migrations are committed
2. **1.2** - downgrade to Partial and reference B9
3. **0.7** - client half done; HIBP is the remaining gap
4. **2.2** - haptics and animation shipped, sound outstanding
5. **B6, S5, S7, S8** - all fixed, currently still listed as open

## Related

- [04-MIGRATIONS.md](04-MIGRATIONS.md) - drift-check procedure
- [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md) - B9 detail
