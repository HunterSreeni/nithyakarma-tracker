# Nithyakarma - Full Project Analysis

**Date:** 16 July 2026
**Reviewer:** Claude (Fable 5)
**Scope:** Web app (React/Vite), Android (Capacitor), Supabase backend (Postgres + edge functions), plus a marketing/business read.
**Method:** Static review of source, SQL migrations and edge functions; `vitest` (155 tests) + `oxlint` + `vite build`; Supabase security/performance advisors and live SQL via MCP; live inspection of the production web app (`nithykarma.netlify.app`); and a live Android smoke test on the running emulator (v0.15.1, 1080x2400) via adb screenshot-tap + logcat.

---

## 0. Snapshot

- The app is **genuinely well-built and polished**. Clean UI, strong retention mechanics (streaks, freezes, tiers, punya, leaderboard, reminders, milestone review prompts), sensible RLS, first-party privacy-friendly analytics, thoughtful legal pages. 155/155 tests pass, lint is clean bar one dead import, build succeeds.
- It is **not release-ready**. There are real secrets committed to git, a timezone correctness bug that hits the core use case, a privacy-by-default mismatch on the leaderboard, an abusable referral flow, and the deployed DB has drifted ahead of the committed migrations.
- Marketing/business: the product is sharp for a narrow community but held back by a **misspelled free-subdomain URL, no custom domain, no logo, thin/unimplemented monetization, and incomplete Play Store prep**.

---

## 1. Security & Vulnerabilities

### CRITICAL

**S1. Live secrets committed to git (VAPID private key + cron secret).**
`app/supabase/migrations/20260707130741_push_notifications_schema.sql` inserts into `app_config` in plaintext, and the file is git-tracked (commit `38aca78`):
- `vapid_private_key = X3QbdHYjMaJ31SBHit7f3Wn7dW5g1Db5YFUSOjfzXcc`
- `cron_secret = d36493d87bea98316550e265a027d91cca5f307f29f3ec63`
- `vapid_email = mailto:huntersreenihs@gmail.com` (personal address exposed)

Impact: anyone with repo access can (a) hit the `send-reminders` edge function directly with the cron secret and blast notifications, and (b) hold the web-push signing key. **Action:** rotate both secrets now, move them to edge-function env/Vault (never a migration), scrub git history (`git filter-repo`/BFG), and rotate the exposed email's exposure expectations.

### HIGH / MEDIUM

**S2. Firebase admin service-account key sits in the working tree.**
`huntersreeni-firebase-adminsdk-fbsvc-d16f5944bc.json` is in the repo root. It is correctly `.gitignore`d (not committed), but a full Firebase **admin** credential living inside the project folder is one `git add -f` or backup sync away from leaking. **Action:** move it out of the repo entirely (e.g. `~/.secrets/`), reference by absolute path.

**S3. `apply_referral` is abusable for ad-free/freeze farming.**
The RPC is callable by any authenticated user at any time (not just at signup) and has no rate limit or abuse guard. Each successful referral grants the referrer **+30 days ad-free and +1 freeze credit**. Spinning up throwaway accounts farms unlimited ad-free time for a referrer - directly draining the app's only monetization lever. Supabase advisor also flags it (SECURITY DEFINER callable by `authenticated`). **Action:** cap referrals per referrer per window, verify the caller is a brand-new account, and/or move the grant server-side behind a signup hook.

**S4. Leaderboard is opt-OUT while community is opt-IN (privacy-by-default mismatch).**
`profiles.community_enabled` defaults **false** (you don't see Sabha), but `profiles.leaderboard_opt_out` defaults **false** too, and `get_leaderboard` (global scope) exposes every non-opted-out profile's `display_name`, `streak`, `punya`, and `tier` to anyone who *did* enable community. Net effect: a user who never engaged with the social feature is still publicly listed to other users by default. This is both a UX surprise and a Play "Data Safety" disclosure issue. **Action:** gate visibility on an explicit share flag (default hidden), so being listed is a deliberate choice.

### LOW / INFO

- **S5.** `tier_for()` lost its `SET search_path` when recreated in `20260715130000_rename_tiers.sql`; advisor now flags `function_search_path_mutable`. Re-add `set search_path = public`.
- **S6.** Supabase Auth: **leaked-password protection (HIBP) is disabled** and min password length is 6. Enable HIBP and raise to 8+ before launch.
- **S7.** No security headers on Netlify. `netlify.toml` has no `[[headers]]` block - missing CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`. Add them.
- **S8. Android:** `android:allowBackup="true"` permits `adb backup` of app data; set to `false` or supply backup rules. Test AdMob app ID + interstitial unit still present (known). Confirm the **merged** manifest carries `POST_NOTIFICATIONS` for Android 13+ (the base manifest only declares `INTERNET`; the push plugin usually injects it - verify).
- **S9.** `app_config` has RLS enabled with no policy (advisor INFO) - this is intentional (service-role only). Leave as is.

---

## 2. Code Bugs

### HIGH

**B1. Timezone mismatch between client "today" and server `current_date` breaks early-morning logging.**
The DB `TimeZone` is **UTC** (verified live: `current_setting('TimeZone') = UTC`). `submit_practice_log` stamps logs and computes streaks with `current_date` (UTC), but the client computes "today" from the device's local zone (`utils/cadence.localDateString`, `useToday`). For an IST user (UTC+5:30), any time between **00:00 and 05:30 local**, the two disagree by a day.

The **Pratahkala (morning) Sandhyavandhanam** - performed at dawn, ~5 AM IST ≈ 23:30 UTC the previous day - is squarely in this window. Consequences:
- The morning slot is logged under the *previous* server date.
- The Today page (querying by local date) shows the slot as **not done**.
- Re-marking hits the `(user_practice_id, log_date, slot)` unique index → duplicate error → silently won't save.
- Day-complete / streak math is evaluated against a date the user isn't looking at.

This hits the single most important flow for the target audience. **Action:** make submit timezone-consistent with the already-tz-aware reminders function - pass the client's local date into the RPC, or compute per-user local date server-side from the stored `timezone`.

### MEDIUM

**B2. Schema drift - committed migrations are behind production.**
The live app has a **Learning** tab and a **panchangam info box** (Parabhava Varsham, thithi, nakshatram, Rahu/Yamagandam/Gulika kalam), and prod has a `learning_progress` table - none of which exist in the committed migrations. Migrations are no longer the source of truth, so a clean rebuild/rollback from the repo would produce a different database. **Action:** reconstruct the missing DDL via MCP `execute_sql` and commit it as migrations (per project rule: no `supabase db pull`).

### LOW

- **B3.** `TodayPage.jsx:2` imports `PartyPopper` but never uses it (oxlint warning). Remove.
- **B6. Foreground pushes are silently dropped on Android (confirmed live).** logcat shows the FCM test message arriving as `pushNotificationReceived`, then `No listeners found for event pushNotificationReceived`. `pushAndroid.js` registers `registration`, `registrationError`, and `pushNotificationActionPerformed` listeners but **not** `pushNotificationReceived`, so a reminder that lands while the app is open shows nothing (no in-app toast, no system notification - Android hands foreground data to the app, which ignores it). The "Send test notification" button therefore looks like it did nothing when the app is foreground. Add a `pushNotificationReceived` listener that raises a local notification (or an in-app cue). *Note: the round-trip itself works end-to-end - token registered, message delivered.*
- **B7. Initial Today-load flashes the empty-state copy.** On load the greeting sub-line renders "Start with a suggested anushtanam below" (the `items.length === 0` empty state) for a beat before the list resolves to the real practices, because `items` is `[]` while `loading` is still true. Gate the empty-state text on `!loading` too.
- **B8.** Stored timezone is `Asia/Calcutta` (a deprecated alias of `Asia/Kolkata`). Harmless today but worth normalizing.
- **B4.** `get_leaderboard` returns up to 50 rows including score-0 profiles, so a sparse global board can show inactive zero-score users. Minor UX; consider filtering `score > 0` (except self).
- **B5.** 553 KB single JS bundle, no code-splitting (build warning). Not a bug per se, but a slow first paint on low-end Android/3G. Lazy-load routes (`React.lazy`) - `driver.js`, `web-push`, admob, and legal pages are all deferrable.

---

## 3. Marketing & Business Analysis

### Positioning
A focused daily-ritual tracker for the Hindu, Brahmin **nitya karma** tradition (Sandhyavandhanam, parayanam, japam), pan-South-Indian (Tamil + Malayalam surfaces). The niche is **sharp and underserved** - a real advantage for a defined community, but a **narrow TAM**. The legal copy is sensitively written (explicitly respects other faiths), which is the right posture for a devotional app and for Play review.

### What's working (keep)
- **Retention design is excellent:** streaks + tier ladder (Shishya→Brahmarishi) + punya + streak freezes + reminders + milestone-gated in-app review is a coherent, well-tuned loop.
- **Family/kids tracking (Bala Sabha)** is a genuine differentiator - parents log children's observances; strong for the target household.
- **WhatsApp-first referral** is the correct growth channel for India.
- **First-party analytics** (own Postgres, no third-party vendor, no PII in props) - privacy-friendly and cheap.

### Flaws holding it back
1. **Brand/URL is the biggest own goal.** The app is on `nithykarma.netlify.app`:
   - It's a **free Netlify subdomain**, not a custom domain - reads as a hobby project, hurts trust and SEO.
   - The subdomain **drops a letter**: the brand is "Nithya**ka**rma" but the URL is "nithy**k**arma" (missing the second `a`). Confusing, kills word-of-mouth recall and typo traffic. **Get a custom domain** (`nithyakarma.app` / `.in`) that matches the spelling exactly.
2. **No logo / app icon** (known) - see §4.
3. **Monetization is thin and partly unbuilt.** Only a light interstitial (still the Google **test** ad unit) plus referral ad-free. The planned ₹99/year ad-free tier isn't implemented, and the referral farming hole (S3) leaks even the ad revenue that does exist. There is no live paid surface.
4. **Half the audience lacks an anchor practice.** Men get Sandhyavandhanam as the daily spine; women get generic parayanam suggestions. Per the product notes, there's no flagship daily practice for women - this caps engagement for ~half of potential users. A defined women's daily practice would materially widen the market.
5. **Play Store prep incomplete** (partly known): real AdMob app ID + ad unit; a **public** privacy-policy URL for the listing (currently in-app only); a complete Data Safety declaration (email, name, gender, timezone, push tokens, AdMob device IDs); content rating; target-API compliance; signed release (still `versionCode 1`); and listing assets (icon, feature graphic, screenshots).
6. **Referral reward is weak.** "1 month ad-free" is a soft incentive when ads are already light/absent; the +1 freeze helps. Consider a value reward (premium content / cosmetic tiers) once a paid layer exists.

### Suggested near-term business priorities
1. Custom domain + matching spelling (cheap, high trust ROI).
2. Close the referral abuse hole before any paid launch.
3. Ship the logo + Play assets.
4. Decide the women's-practice anchor to unlock the other half of the audience.
5. Implement the ₹99/year ad-free tier so referrals have something real to discount.

---

## 4. Logo Direction (a read, not a final mark)

**Constraints from history:** prior ॐ+ௐ fusion and an N+क monogram were rejected as "too modern/western, not desi." App convention is **romanized, never Devanagari**, so fine Devanagari/Tamil glyphs are out (also illegible at 48 px). The mark must survive as a **monochrome notification icon**, an **Android adaptive icon** (safe-zone), and a **favicon** - so it needs to be a bold, simple silhouette, not a detailed illustration.

**Recommended direction: an iconic ritual motif, not a letterform.**
- **First choice - sun over the horizon/water (sandhya).** Sandhyavandhanam is literally worship at the sun's junctions (dawn/dusk). A simple sun on a horizon line is ownable, instantly readable tiny, directly tied to the core practice, and warm rather than sectarian. Palette: the existing saffron `#FF9933` primary + a deep maroon or indigo accent.
- **Second - a diya/agni flame** (daily lamp/fire): equally devotional, very legible as a silhouette, strong monochrome notification icon.
- **Third - a kolam/mandala roundel:** geometric, unmistakably South Indian, excellent as an adaptive icon; slightly less "instant" than the sun/flame at tiny sizes.

**Avoid** a plain ॐ - it's generic and reads as "just another Hindu app"; the sun/flame is more distinctive and less likely to be confused with the dozens of existing ॐ-marked apps.

**Wordmark:** keep the two-tone "Nithya" + "karma" lockup already in the UI, pair the icon with a calm humanist serif or a warm rounded sans for a devotional-but-friendly tone. Ensure the icon works locked-up *and* standalone.

---

## 5. Verification performed
- `npm run test` → **155 passed / 27 files**.
- `npm run lint` → clean except 1 unused import + fast-refresh warnings.
- `npm run build` → success (553 KB bundle warning).
- Supabase advisors (security + performance) via MCP - findings folded into §1/§2.
- Live SQL: DB timezone = UTC (confirms B1); e2e account `community_enabled=false` + `leaderboard_opt_out=false` (confirms S4 live); ad-free until 2027-01-11.
- **Live web app** (`nithykarma.netlify.app`): Today 2/2, Profile complete; no error banners, nav intact, no horizontal overflow. Prod is ahead of the repo (Learning + panchangam), confirms B2.
- **Live Android** (emulator, app v0.15.1): Today, Learning (verse-by-verse Hanuman Chalisa with English/Malayalam/romanized-Sanskrit toggle), History, Referrals, Profile all render and navigate correctly. **FCM push works end-to-end** - registration token obtained and stored, "Send test notification" delivered a `pushNotificationReceived` event (see B6 for the foreground-display gap). `reminders` notification channel present (importance 5). Ad path could not be exercised (account is ad-free); ad logic verified statically. Initial Today load flashes empty-state copy (B7).
