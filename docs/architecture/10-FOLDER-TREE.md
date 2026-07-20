# 10 - Folder Tree

The full repo tree, every file, captured 20 July 2026. Purpose: an AI reviewing this
project can grep this file instead of running `find`/`ls` cold every session.

Regenerate with:

```bash
tree -I 'node_modules|.git|dist|dev-dist|test-results|playwright-report|.playwright-cli|android/build|android/.gradle|android/app/build|_archive' -L 5 --dirsfirst
```

(falls back to `find . -maxdepth 5 -type d \( -name node_modules -o -name .git -o -name dist \) -prune -o -print` if `tree` isn't installed)

```
.
├── app
│   ├── android
│   │   ├── app
│   │   │   ├── src
│   │   │   │   ├── androidTest
│   │   │   │   ├── main
│   │   │   │   └── test
│   │   │   ├── build.gradle
│   │   │   ├── capacitor.build.gradle
│   │   │   ├── google-services.json
│   │   │   └── proguard-rules.pro
│   │   ├── capacitor-cordova-android-plugins
│   │   │   ├── build
│   │   │   ├── src
│   │   │   ├── build.gradle
│   │   │   └── cordova.variables.gradle
│   │   ├── gradle
│   │   │   └── wrapper
│   │   ├── build.gradle
│   │   ├── capacitor.settings.gradle
│   │   ├── gradle.properties
│   │   ├── gradlew / gradlew.bat
│   │   ├── settings.gradle
│   │   └── variables.gradle
│   ├── e2e                              # Playwright specs + Android shell journeys
│   │   ├── android-referral.sh
│   │   ├── android-sandhya.sh
│   │   ├── android-smoke.sh
│   │   ├── auth-negative.spec.js
│   │   ├── auth-signout.spec.js
│   │   ├── journey-female.spec.js
│   │   ├── journey.spec.js
│   │   └── referral.spec.js
│   ├── public
│   │   ├── fonts                        # DM Sans, Sora, Yatra One - self-hosted, CSP pins font-src 'self'
│   │   ├── favicon.svg                  # the shipped app icon (saffron abstract mark)
│   │   ├── icons.svg
│   │   ├── periyava.jpg
│   │   └── sw.js                        # service worker
│   ├── scripts                          # panchangam generation (see 08-PANCHANGAM.md)
│   │   ├── content
│   │   │   └── hanuman-chalisa.json     # Learning-page verse content
│   │   ├── __tests__
│   │   │   └── panchangam-output.test.js
│   │   ├── generate-panchangam.cjs
│   │   └── panchangam-2026.json
│   ├── src
│   │   ├── assets                       # hero.png, react.svg, vite.svg
│   │   ├── components                   # 19 components, each with its own __tests__ pair
│   │   │   ├── AuthPage.jsx / CelebrationModal.jsx / ErrorBanner.jsx / GuidedTour.jsx
│   │   │   ├── HistoryPage.jsx / InfoPages.jsx (About + Karma explainer)
│   │   │   ├── Layout.jsx / LearningPage.jsx / LegalPages.jsx (Terms + Privacy)
│   │   │   ├── NotificationSettings.jsx / Onboarding.jsx / PanchangamBox.jsx
│   │   │   ├── ProfilePage.jsx / ProfileSwitcher.jsx / ReferralsPage.jsx
│   │   │   ├── ResetPassword.jsx / SabhaPage.jsx / TodayPage.jsx / Turnstile.jsx
│   │   ├── hooks                        # useAuth, useFocusTrap, useLearning, useNotifications, usePanchangam, useToday
│   │   ├── lib
│   │   │   └── supabase.js              # the single Supabase client, fetch-timeout wrapper
│   │   ├── test
│   │   │   └── setup.js                 # Vitest setup
│   │   ├── utils                        # 15 utils: ads, analytics, cadence, contrast, friendlyError,
│   │   │   │                            # haptics, notifications, panchangamScript, practiceIcons,
│   │   │   │                            # pushAndroid, review, sentry, share, tiers, webPush
│   │   ├── App.css                      # UNUSED - Vite boilerplate, not imported anywhere, do not trust its tokens
│   │   ├── App.jsx                      # routing + auth gate
│   │   ├── index.css                    # THE real design tokens, @font-face, brand palette
│   │   └── main.jsx / version.js
│   ├── supabase
│   │   ├── functions
│   │   │   ├── send-reminders           # the cron-driven push sender
│   │   │   ├── send-test-notification
│   │   │   └── _shared/push.ts          # FCM + Web Push send logic, VAPID/service-account handling
│   │   ├── migrations                   # 35 SQL files - see 04-MIGRATIONS.md
│   │   └── tests                        # SQL integration assertions + throwaway-account seeds
│   ├── capacitor.config.ts              # appId org.nithyakarma.app, loggingBehavior: 'none'
│   ├── netlify.toml                     # THE real CSP/HSTS headers (see note below)
│   ├── package.json / package-lock.json
│   ├── playwright.config.js
│   ├── vite.config.js
│   └── *.png                            # store-listing / tour screenshots taken at repo root of app/ (messy, not in docs/store-screenshots/)
├── design-prototypes                    # static HTML mockup galleries, not live code
│   ├── app-design.html
│   ├── periyava.jpg
│   └── web-design.html
├── docs
│   ├── architecture                     # THIS tree - 00 through 11 + README
│   ├── store-screenshots                # draft Play Store screenshots, NOT final (see README there)
│   ├── DATA-SAFETY.md                   # Play Store Data Safety declarations
│   ├── DISSECTION.md                    # original pre-launch teardown
│   ├── PLAY-STORE-LISTING.md
│   ├── PROJECT-ANALYSIS-2026-07-16.md
│   ├── ROADMAP.md                       # product ideas + domain/email status - "what's intended"
│   ├── TEST-PLAN.md / TEST-RESULTS.md
│   └── UPGRADE-PLAN.md                  # the Intent-by-Intent execution plan
├── logo-concepts                        # UNTRACKED, not in git - branding exploration
│   ├── fonts
│   │   └── SAMARN__.TTF, SAMARO__.TTF   # ⚠️ actual Samarkan font files - 1993 shareware,
│   │                                    #    personal-use-only license. NEVER commit or ship these.
│   ├── icon
│   ├── karma-arrows-concept-doodle-hand-*.webp  # watermarked Shutterstock reference, do not trace into shipped assets
│   └── nithyakarma-infinity-karma.svg   # REJECTED symbol mark, parked
├── site                                 # static marketing site for nithyakarma.org - see 11-MARKETING-SITE.md
│   ├── fonts                            # same DM Sans/Sora/Yatra One files as app/public/fonts
│   ├── favicon.svg                      # same favicon as the app
│   ├── index.html / karma.html / support.html
│   ├── style.css
│   ├── robots.txt / sitemap.xml
│   └── netlify.toml                     # SEPARATE Netlify site, base = "site"
├── google-secret.txt                    # ⚠️ untracked, likely holds a credential - never git add this
├── netlify.toml                         # root: base = "app", NO headers block (see caveat below)
├── practices-catalog.md
└── release-please-config.json
```

## Things this tree makes easy to forget otherwise

- **Two `netlify.toml` at different depths carry different responsibilities.** Root
  (`/netlify.toml`) just points the build at `app/` and has no security headers.
  `app/netlify.toml` carries the actual CSP/HSTS. `site/netlify.toml` is a third,
  fully independent one for the marketing site's own Netlify site. Don't assume
  headers apply just because a `netlify.toml` exists at the path you're looking at.
- **`app/src/App.css` is dead code.** Only `App.jsx` is imported in `main.jsx`; the
  CSS file's `--accent`/`--accent-bg` tokens are unused Vite-template leftovers and do
  NOT reflect the real brand palette. The real tokens are in `app/src/index.css`.
- **`app/public/fonts/` and `site/fonts/` are two separate copies** of the same font
  files (self-hosted independently per-site because each site's CSP pins `font-src` to
  `'self'`). Changing brand fonts means updating both.
- **`logo-concepts/` is untracked and contains an actual licensed-shareware font**
  (Samarkan `.TTF` files). It exists locally for reference only - `.gitignore` doesn't
  need to cover it since it was never staged, but be deliberate never to `git add` it.
- **`app/*.png` screenshots live loose at the `app/` root**, separate from the curated
  `docs/store-screenshots/` - the former are ad hoc dev captures, the latter are the
  vetted Play Store draft set.

## Related

- [00-OVERVIEW.md](00-OVERVIEW.md) - the annotated, summarized version of this tree
- [11-MARKETING-SITE.md](11-MARKETING-SITE.md) - `/site` in depth
