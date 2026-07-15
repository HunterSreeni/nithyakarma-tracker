# Nithyakarma - Product Dissection

> A full teardown of the app as a product headed for the Play Store and web.
> Source, flows, design system, Android build, monetization wiring, and repo
> hygiene were all reviewed. Companion execution plan: `docs/UPGRADE-PLAN.md`.

**Date:** 2026-07-12
**Reviewed build:** `main` @ commit `4554478`

---

## What it is

A daily Hindu ritual tracker (Sandhyavandhanam + parayanams) with streaks,
punya-point tiers, a community "Sabha" leaderboard, family/kids profiles, a
WhatsApp referral loop, and AdMob monetization on Android. React + Vite web
wrapped in Capacitor for Android; iPhone users get the web app (no ads).

## One-line verdict

The product thinking is genuinely strong and the codebase is clean and
well-tested, but it is **not launch-ready**. Two hard blockers (default app
icon, test AdMob IDs) plus several missing user-flow pieces would get it
rejected, left unmonetized, or churning users on day one.

**Readiness: ~70% built, ~40% launch-ready.**

---

## THE GOOD (keep - this is the moat)

- **Culturally precise domain model.** Sandhyavandhanam as a 3-slot constant
  (Prathakala / Madhyanika / Saayamkala), male-only + post-upanayanam gating,
  weekly practices that do not break streaks on off-days, sequence practices
  ("Dasakam 34/100"), Bala Sabha kids leaderboard with first-name-only privacy.
  This is insider knowledge no generic competitor replicates. It is the real
  differentiator, not the streaks.
- **Clean write path.** `submit_practice_log` RPC is server-authoritative;
  celebration and ad fire only from a verified `{saved:true}` response
  (`useToday.js:44`, `CelebrationModal.jsx:13`). A failed save never shows an ad.
- **Social growth loop wired end-to-end.** Referral code -> WhatsApp share card
  -> `/r/:code` deep link -> onboarding auto-reads it (`Onboarding.jsx:55`).
  Both sides get a reward. Most important thing for a zero-budget launch, and it
  exists.
- **Tier progression** (Shishya -> Brahmarishi, Vishwamitra's ladder) is a smart,
  on-theme retention hook that mirrors the DB.
- **Legal + privacy hygiene:** Terms/Privacy pages, leaderboard opt-out, real
  account and data deletion with DELETE confirmation. Play Store Data Safety
  will need this and it is already here.
- **Secrets are clean.** Firebase service-account JSON and APKs are gitignored
  and never committed - verified against history. No leak.
- **Test coverage** across cadence, tiers, ads, share, a11y, and components.
  Rare at this stage.

---

## THE UGLY (hard launch blockers - fix before uploading anything)

1. **The app icon is the default Capacitor placeholder** - a blue "X" on a white
   grid (`mipmap-*/ic_launcher*.png`, both legacy and adaptive foreground). The
   in-app diya wordmark is good, but the icon on the home screen and the Play
   Store listing is the stock template logo. On a religious app this reads as
   fake/abandonware and will tank install rate and trust. **This is the "missing
   logo" - confirmed.**

2. **AdMob is running Google's TEST IDs in production config.** App ID
   `ca-app-pub-3940256099942544~3347511713` (manifest) and the test interstitial
   unit with `isTesting:true` / `initializeForTesting:true` (`ads.js:5,26`).
   Result: zero revenue, and shipping test IDs to production is an AdMob policy
   violation that can get the app suspended. The entire monetization is a stub.
   The referral reward ("1 month ad-free") is meaningless until real ads exist.

3. **No password reset / forgot-password flow.** On Android, email + password is
   the only auth (Google is web-only), and there is no recovery path. The
   audience skews older; forgotten passwords with no reset = dead accounts and
   support pain. The signup copy even says "check spam" - email deliverability is
   already a known weak point.

---

## THE BAD (will not block upload, will hurt growth/retention)

- **Google sign-in disabled on Android** (`AuthPage.jsx:52`) - the low-friction
  path is off on the exact platform being monetized. **Phone-number OTP** would
  convert far better than email + password for this demographic.
- **"Friends" leaderboard tab has no way to add friends.** The scope exists in
  the RPC (`SabhaPage.jsx:8`) but there is no add-friend UI anywhere. Dead tab.
- **No streak insurance.** A single missed day resets to 0. For a daily religious
  obligation this is uniquely demoralizing (guilt + churn). Duolingo's number one
  retention mechanic is the **streak freeze**. Needs a grace day / freeze.
- **Reminders are not tied to Sandhya windows.** The three time-of-day slots are
  known and the user is a devotee - notifications at actual sunrise/noon/sunset
  (by location) would be a killer, on-theme feature. Generic reminders waste the
  best hook.
- **It is a pure tracker with no content.** It tracks "Vishnu Sahasranamam" but
  does not show its text/audio. Bundling romanized lyrics + audio would multiply
  stickiness and is the most natural premium lever beyond ads.
- **The celebration is static emoji.** Duolingo's dopamine is sound + motion +
  haptics. `sparkle/tada/flame` with no animation/sound/vibration underdelivers
  on the one moment that should feel rewarding.
- **No analytics or crash reporting.** No funnel, retention, or DAU visibility,
  no Sentry. A money-making product cannot run blind.
- **No in-app review prompt.** Play Store ranking is driven by ratings; nothing
  asks happy users to rate after a streak milestone.
- **Female experience is thin.** No male-only flagship constant, and no female
  equivalent surfaced. Women are a large share of daily-parayanam households; the
  empty Today screen for them is a missed activation.
- **Repo bloat:** two 16MB debug APKs sit in the working tree (gitignored, fine)
  but clutter the folder.

---

## Missing pieces checklist (the little things that add up)

**Launch / store**
- [ ] Real launcher icon + adaptive icon (P0)
- [ ] Play Store feature graphic (1024x500), phone screenshots, short + full desc
- [ ] Hosted Privacy Policy URL (Play requires a public URL, not just in-app)
- [ ] Data Safety form + content rating questionnaire
- [ ] Release signing keystore + `applicationId` verified (`in.co.sreeniverse.nithyakarma`)
- [ ] Version name/code + a "What's new" habit (see UPGRADE-PLAN release engineering)

**User flow**
- [ ] Forgot password (P0), or switch to phone OTP
- [ ] Value-prop screen before the gender form (onboarding jumps straight to a form)
- [ ] Add-friend flow for the Friends tab
- [ ] In-app support/contact channel
- [ ] Empty-state activation for female users

**Monetization**
- [ ] Real AdMob account + production app ID + interstitial unit (P0)
- [ ] Verify the ad-free referral reward actually gates real ads
- [ ] Consider a premium tier (audio/lyrics, ad-free, advanced stats)
- [ ] Analytics + crash reporting to measure any of it

---

## Color and typography psychology - for the Brahmin audience

Palette: **saffron (`#FF9933` / `#F37C02`) + cream "paper" (`#f5f0e8`) +
ink-black chrome**, with gold/maroon/green accents.

### Why it works (and it largely does)

- **Saffron / kavi / bhagwa is the single most sacred color in the tradition** -
  agni, renunciation, the sanyasi's robe, the temple flag, purity. `#FF9933` is
  literally the Indian flag's saffron. For a devout Brahmin user this reads
  instantly as "sacred, ours, legitimate." Best possible primary choice.
- **Cream / off-white "paper"** evokes vibhuti (sacred ash), sandal paste,
  palm-leaf granthas, and madi (ritual-purity cloth). Calm, non-flashy,
  respectful. Correct over stark white.
- **Deep maroon/brown gradients** (auth hero, Hall banner) read as temple
  sanctum / aged wood / kumkum. On theme.
- **The Periyava image + "Anudinam anushtanam" tagline** anchor trust with the
  Kanchi/Smarta demographic specifically. Strong.

### Where the palette fights itself

- **Black topbar (`#0d0d0d`) reads "tech," not "sacred."** Pure black chrome
  against a warm devotional palette makes the app feel like a fintech app wearing
  saffron. A deep maroon or espresso-brown topbar would feel more coherent and
  reverent.
- **The green cards** (WhatsApp `#25D366`, referral `#0d3b26`) are off-system.
  Justifiable for WhatsApp brand recall, but the dark-green referral card clashes
  with the saffron world. Give the referral card a saffron/gold treatment and
  reserve green strictly for the WhatsApp button.
- **Syne** (display font) is geometric/futuristic - fine in tiny uppercase
  labels, but carries a slightly "startup" tone that mildly undercuts the
  devotional register.

### The real problem - accessibility for an older audience (concrete, not vibes)

- White text on the primary saffron button (`#F37C02`) computes to **~2.7:1
  contrast** - it **fails** WCAG AA (needs 4.5:1, or 3:1 for large text), and the
  button text is small + bold, not "large."
- The ubiquitous muted meta text (`#a89a85` on cream) is **~2.75:1** - also fails
  for small text.
- Base font sizes are tiny (0.7rem / ~11px for meta, 300 weight). Core users
  skew 45-70+ with presbyopia. The thin-grey-small-text aesthetic is exactly
  wrong for them. **Darken secondary text, bump base sizes, respect OS Dynamic
  Type.** This single change likely moves retention more than any feature.

**Net:** the hue strategy is excellent and audience-perfect; the execution has a
coherence wobble (black/green intrusions) and a real legibility problem for the
actual age of the users.

---

## What Duolingo-class trackers do that this is missing

| Mechanic | Have it? | Gap |
|---|---|---|
| Streak | Yes | No **freeze/grace** - a miss = 0 = churn |
| Progression / levels | Yes (tiers/punya) | Fine |
| Social leaderboard | Yes (Sabha) | Friends tab non-functional |
| Rewarding "win" moment | Partial (static emoji) | No sound/haptic/animation |
| Smart reminders | Partial (generic) | Not tied to Sandhya times |
| Content / value beyond tracking | No | No lyrics/audio - thin |
| Rating prompt | No | Hurts store ranking |
| Analytics-driven iteration | No | Flying blind |

---

## Prioritized summary

**P0 - before uploading:** launcher icon, real AdMob IDs, forgot-password (or
phone OTP), Play Store assets + hosted privacy URL + Data Safety, contrast/font
accessibility pass.

**P1 - first weeks:** streak freeze, Sandhya-time reminders, analytics + crash
reporting, in-app review prompt, female activation, finish or hide Friends tab.

**P2 - depth for a premium tier:** bundle romanized lyrics/audio, sound/haptic/
animation on celebration, recolor chrome for palette coherence.

Full sequencing, intents, and testing gates are in `docs/UPGRADE-PLAN.md`.
