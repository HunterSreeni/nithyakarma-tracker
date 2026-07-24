# Intent 0.6 - Play Store release readiness

Fixes the blockers/issues from the 2026-07-24 pre-release audit. Each sub-intent
has a **gate**: run `npm run lint && npx vitest run && npm run build` (from `app/`)
after any code phase before moving on (per the per-phase testing gate). Playwright
e2e is run once at the end (headless on this box).

Status: 🔴 todo · 🟡 in progress · ✅ done

## 0.6.1 - Publicly readable legal pages (fixes B2) ✅
Play needs a privacy-policy URL whose text is readable **without** running the app's
JS. The app's `/privacy` `/terms` are client-rendered SPA routes that return only the
shell to crawlers. Serve the same text as static HTML on the marketing site.
- `site/privacy.html`, `site/terms.html` - static, full text, site styling.
- Repoint footers in `site/index.html`, `karma.html`, `support.html` to
  `/privacy.html` + `/terms.html` (was `app.nithyakarma.org/...`).
- Play Console privacy URL = `https://nithyakarma.org/privacy.html`.
- Gate: pages exist, valid HTML, footer links updated everywhere.

## 0.6.2 - AdMob UMP consent + Data Safety (fixes H1, H2) ✅
- `ads.js`: on native, `requestConsentInfo` -> `showConsentForm` when required, and
  only request/show ads when `canRequestAds` is true.
- `ads.test.js`: mock consent methods + gate tests.
- `docs/DATA-SAFETY.md`: add AdMob / advertising-ID row + "Contains ads".
- `docs/PLAY-STORE-LISTING.md`: note the "Contains ads" + Data-Safety implications.
- Gate: lint + vitest + build.

## 0.6.3 - Android release signing scaffold (fixes B1) ✅
- `app/android/app/build.gradle`: `signingConfigs.release` read from a gitignored
  `keystore.properties` (guarded so debug/CI builds without it still work).
- `app/android/keystore.properties.example` template.
- `.gitignore`: `keystore.properties`, `*.jks`, `*.keystore`.
- **User step**: generate the upload keystore with `keytool` (secret - can't be done
  for you) and fill `keystore.properties`. Then `./gradlew bundleRelease`.

## 0.6.4 - Icon wiring + marketing polish ✅
- `npm run build && npx cap sync android` so the new icons/web bundle embed.
- `og:image` (1200x630 from the wordmark) added to site pages + app `index.html`.
- Remove unreferenced `app/public/favicon.svg`, `app/public/icons.svg`,
  `site/favicon.svg` (old logo).
- `.gitignore`: `malayalam-panchangam/` (copyrighted photos, like the pambu folder).
- Gate: build + cap sync + vitest.
</content>
</invoke>
