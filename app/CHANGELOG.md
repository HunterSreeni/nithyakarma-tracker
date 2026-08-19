# Changelog

## [0.31.8](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.7...app-v0.31.8) (2026-08-19)


### Bug Fixes

* also closes the notification-delivery deploy-drift bug found while ([a6d3e28](https://github.com/HunterSreeni/nithyakarma-tracker/commit/a6d3e288f06df614139fdfe50172a1ab23f54458))
* repair yesterday Sandhya streak ([edaef2a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/edaef2ae484c53deebcad84fb89c54b2e7a41acb))
* yesterday Sandhya streak repair + production release follow-ups ([39907b9](https://github.com/HunterSreeni/nithyakarma-tracker/commit/39907b91fb1aa5e05939da5e33b59173ec563d16))

## [0.31.7](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.6...app-v0.31.7) (2026-08-14)


### Bug Fixes

* Gayatri count prompt for yesterday's sandhya backfill ([2401743](https://github.com/HunterSreeni/nithyakarma-tracker/commit/24017434cb74af9cee38529a8f3970885eefcc68))
* prompt for Gayatri count when backfilling yesterday's sandhya ([705c9d4](https://github.com/HunterSreeni/nithyakarma-tracker/commit/705c9d42026dab902e8df20b16ede88f37416385))
* stop native min validation from swallowing GayatriCountModal's error ([728bab7](https://github.com/HunterSreeni/nithyakarma-tracker/commit/728bab791b0273792c214d02006a755e4a1eb10f))

## [0.31.6](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.5...app-v0.31.6) (2026-08-13)


### Bug Fixes

* stop Android push toggle showing enabled on unregistered devices ([234eefa](https://github.com/HunterSreeni/nithyakarma-tracker/commit/234eefabf6d1b561ad9fca2e314f2e3c910fb44c))
* stop Android push toggle showing enabled on unregistered devices ([e3ddcfc](https://github.com/HunterSreeni/nithyakarma-tracker/commit/e3ddcfce9b3e530e8b23bb7feca146f2cbdd4452))

## [0.31.5](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.4...app-v0.31.5) (2026-08-13)


### Bug Fixes

* resolve npm audit vulnerabilities within existing semver ranges ([7f1e27a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/7f1e27a5fede4044a22588516ca0505b7b18b2c9))

## [0.31.4](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.3...app-v0.31.4) (2026-08-13)


### Bug Fixes

* rewrite mobile resume data lifecycle ([465551b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/465551b56034d4fdb838ec15f8b2da61717cf671))
* rewrite mobile resume data lifecycle ([8f95eeb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8f95eebe4482c4d638e48f18a6faf40706e6f90a))

## [0.31.3](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.2...app-v0.31.3) (2026-08-12)


### Bug Fixes

* count Sandhya backfills toward streaks ([0357463](https://github.com/HunterSreeni/nithyakarma-tracker/commit/035746364b3b7bb088cc1a180e8786df56defa8a))

## [0.31.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.1...app-v0.31.2) (2026-08-11)


### Bug Fixes

* bound Supabase fetches on older Android WebViews ([37097bb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/37097bb3f8d07c0e4fcaed546a08cda3c3e91066))
* prevent stuck loading after Android resume ([38bb9a3](https://github.com/HunterSreeni/nithyakarma-tracker/commit/38bb9a3397754221575c862bc7d54a5abab7fc56))

## [0.31.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.31.0...app-v0.31.1) (2026-08-11)


### Bug Fixes

* stop weekly practices from being day-gated; split Sri Rudram into 3 slots ([c2bd3fd](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c2bd3fdef439bbc82de5fd63c49c48fa71de641a))
* stop weekly practices from being day-gated; split Sri Rudram into 3 slots ([3fa4677](https://github.com/HunterSreeni/nithyakarma-tracker/commit/3fa4677df7a295cec2a3aceadba522614ebfefc9))

## [0.31.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.30.0...app-v0.31.0) (2026-08-11)


### Features

* add Ekadashi/Dwadashi/Trayodashi/Purnima observance banners ([a881757](https://github.com/HunterSreeni/nithyakarma-tracker/commit/a8817572dd4488208e9079d55d8f80df3907e8f8))


### Bug Fixes

* give History and Referrals a cache fallback like Today's list ([72e1a94](https://github.com/HunterSreeni/nithyakarma-tracker/commit/72e1a9482093770c96796a8405e051497671f8b8))
* History/Referrals stuck-loading + feat: tithi observance banners ([8edee43](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8edee436ead964ff5c65ca6b71c7aab9df6b9549))

## [0.30.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.7...app-v0.30.0) (2026-08-10)


### Features

* let a Sandhya slot be backdated to yesterday, punya-only ([f5a395d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/f5a395de6e3c77f9dbf1fd20a7dd9a21cb9eb967))
* show each subject's own punya and tier; add Brahmayagnam + Purusha Suktam ([115bd80](https://github.com/HunterSreeni/nithyakarma-tracker/commit/115bd8008608196b24b2447a2ba46136e43ff0ce))
* yesterday Sandhya catch-up, per-subject punya/tier UI, Brahmayagnam + Purusha Suktam ([fbd6546](https://github.com/HunterSreeni/nithyakarma-tracker/commit/fbd65461cd42e6a6e376033b654a4fdf994b5435))

## [0.29.7](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.6...app-v0.29.7) (2026-08-10)


### Bug Fixes

* address code-review findings on the streak and Today-cache work ([96ee301](https://github.com/HunterSreeni/nithyakarma-tracker/commit/96ee301ca403b8e71850af0bc2fb5830af7df734))
* decay streaks against each subject's own local day, not one UTC date ([2e8c91e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2e8c91ee303b2a381b20299821e94632977d3e62))
* stop the streak freeze being spent without bridging the gap ([9c577d6](https://github.com/HunterSreeni/nithyakarma-tracker/commit/9c577d63574ce7f6afb04f9e047983e2887a336f))
* streak freeze correctness, timezone-aware decay, and instant Today reopen ([50d5646](https://github.com/HunterSreeni/nithyakarma-tracker/commit/50d564618c67d25442bd8ea4e87228390c84d84c))


### Performance Improvements

* paint the Today list from cache instead of a spinner on reopen ([0f55c58](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0f55c5847e1ad202d8fe300a2ed0f953c88790fd))

## [0.29.6](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.5...app-v0.29.6) (2026-08-09)


### Bug Fixes

* kill root cause of stuck-loading reload wall on Android resume ([2778275](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2778275b0648263ea5caf861606f2797b02a428c))
* render session/profile from cache instantly on cold restart ([5ec9287](https://github.com/HunterSreeni/nithyakarma-tracker/commit/5ec9287c6f17fe96e68127ab584ef7f872b1647e))
* stop stuck-loading watchdog from firing during auth-js's own refresh retries ([116a90d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/116a90dd18198921f813fca841fca4b8778c5ac4))

## [0.29.5](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.4...app-v0.29.5) (2026-08-09)


### Bug Fixes

* load profile and family_members in parallel, not sequentially ([b7b1352](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b7b135215e21e3aff031a41c48200d090080fd83))
* proactively consume a freeze credit and notify on streak decay ([644fb37](https://github.com/HunterSreeni/nithyakarma-tracker/commit/644fb37d99e5a0556285d3a816136cbd1f8e44df))
* stuck-loading reload wall + streak freeze not consumed/notified ([3154822](https://github.com/HunterSreeni/nithyakarma-tracker/commit/3154822e8262eb9575c00cba15410442fabc8d35))

## [0.29.4](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.3...app-v0.29.4) (2026-08-06)


### Bug Fixes

* capture WhatsApp share card without losing content or offset ([44b0b2e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/44b0b2e39eb69110ecf4b604b43d56a963402496))
* capture WhatsApp share card without losing content or offset ([6ba9389](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6ba9389f0d0a1f5ecf3df301c7940d8091e63ee6))

## [0.29.3](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.2...app-v0.29.3) (2026-08-06)


### Bug Fixes

* export WhatsApp share card at full status resolution ([7894292](https://github.com/HunterSreeni/nithyakarma-tracker/commit/7894292e488b4b0c58a24416602d723607cd7984))

## [0.29.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.1...app-v0.29.2) (2026-08-06)


### Bug Fixes

* silence 8am/8pm streak-nudge push once the day is already complete ([9b4bc62](https://github.com/HunterSreeni/nithyakarma-tracker/commit/9b4bc62aa416c58112bed95d44ba2948e7239ebc))
* silence 8am/8pm streak-nudge push once the day is already complete ([588f7a9](https://github.com/HunterSreeni/nithyakarma-tracker/commit/588f7a9b83fd00129350a383565a2855022a07c6))

## [0.29.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.29.0...app-v0.29.1) (2026-07-27)


### Bug Fixes

* auto-reload on stale chunk fetch, strip analytics from Android build ([4df56de](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4df56de7838092aacd2afa686e8509982060d5ed))

## [0.29.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.28.0...app-v0.29.0) (2026-07-27)


### Features

* add Cloudflare Web Analytics to app subdomain ([ecc1245](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ecc1245200bbec45bc10dc7215b702b56820f826))

## [0.28.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.27.0...app-v0.28.0) (2026-07-26)


### Features

* add Samidhadhanam (brahmachari-only) and user-entered Gayatri count ([8c2edfe](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8c2edfe2889c2810fe44da44daa58503a228dbeb))
* onboard panchangam tradition + tharpanam/observance reminders, fix guided-tour scoping ([712f214](https://github.com/HunterSreeni/nithyakarma-tracker/commit/712f2146f813ca9e3a0a217e7601fa6142489baf))

## [0.27.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.26.0...app-v0.27.0) (2026-07-24)


### Features

* wire the real Nithyakarma wordmark into every UI surface ([73c7771](https://github.com/HunterSreeni/nithyakarma-tracker/commit/73c7771407a7d049d4cd3d78e515d1822da65fed))
* wire the real Nithyakarma wordmark into every UI surface ([6a5f59e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6a5f59ebff556c11e1cf6cb1f57448ed6b8dfa31))

## [0.26.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.25.0...app-v0.26.0) (2026-07-24)


### Features

* Play Store release readiness - legal pages, ad consent, signing, branding ([6877fb6](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6877fb600626addb74da44d78ce914dafe12095e))
* Play Store release readiness - legal pages, ad consent, signing, branding ([a490d49](https://github.com/HunterSreeni/nithyakarma-tracker/commit/a490d49814cee35192b88ea184d9970a914a5d2e))

## [0.25.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.24.2...app-v0.25.0) (2026-07-23)


### Features

* add Sai Baba Aarti as a weekly Thursday stotram ([17022cf](https://github.com/HunterSreeni/nithyakarma-tracker/commit/17022cf4f316df1a038edc3973e45ac1407526b3))


### Bug Fixes

* **e2e:** use KEYCODE_TAB/ENTER for Android login instead of coordinate taps ([58666b4](https://github.com/HunterSreeni/nithyakarma-tracker/commit/58666b4439bf8c74d492a50d8e59c404012df5b9))

## [0.24.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.24.1...app-v0.24.2) (2026-07-23)


### Bug Fixes

* notification prompt re-shown on every sign-in, plus Android e2e script fixes ([f941869](https://github.com/HunterSreeni/nithyakarma-tracker/commit/f941869adeb20741f627a4efbca79be36e94ec06))
* notification prompt re-shown on every sign-in, plus Android e2e script fixes ([2df985a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2df985a1d3d7c7495da279a45951366ae4ecf8cc))

## [0.24.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.24.0...app-v0.24.1) (2026-07-23)


### Bug Fixes

* stop unconditional notification scheduling, wire auth-signout into CI ([bc7f15c](https://github.com/HunterSreeni/nithyakarma-tracker/commit/bc7f15c84c34d87de04bf0f6337269120f45733d))

## [0.24.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.23.0...app-v0.24.0) (2026-07-23)


### Features

* **app:** 2027 panchangam data, tradition preference, tharpanam+observance notifications ([6804659](https://github.com/HunterSreeni/nithyakarma-tracker/commit/680465939d0a8130972bcd64b1ec8cacd1b6285e))
* **app:** production AdMob IDs and Sentry crash reporting ([ec379d1](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ec379d15996bf5ebfe1d1262a130909d4059c3c6))
* cut over nithyakarma.org and app.nithyakarma.org custom domains ([b7bb882](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b7bb882973e33696a66624316cf02174029ce446))

## [0.23.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.22.1...app-v0.23.0) (2026-07-21)


### Features

* **onboarding:** prompt to enable notifications right after signup ([ccd7bbc](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ccd7bbc42f0b49dc53f46f66630fe65060c7494f))
* **onboarding:** prompt to enable notifications right after signup ([38e7dc9](https://github.com/HunterSreeni/nithyakarma-tracker/commit/38e7dc93acba2202613c374782ae317ee3bf8822))

## [0.22.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.22.0...app-v0.22.1) (2026-07-21)


### Bug Fixes

* **learning:** render Ramayanam PDFs via pdf.js instead of iframe ([e1ed143](https://github.com/HunterSreeni/nithyakarma-tracker/commit/e1ed143287e5388bb0e325720cf25838c0825e02))
* **learning:** render Ramayanam PDFs via pdf.js instead of iframe ([d0fe61b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/d0fe61bd8be652241ea6a2ec2d03aea53890eddb))

## [0.22.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.21.1...app-v0.22.0) (2026-07-21)


### Features

* **learning:** add sarga-by-sarga Ramayanam reader (6 kandams) ([8659f7c](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8659f7c27524a164defefa72572ac5ed66400c6a))

## [0.21.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.21.0...app-v0.21.1) (2026-07-21)


### Bug Fixes

* **today:** clarify the daily-progress ring and greeting text ([fd93dfb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/fd93dfb08fc5f937417a2a51d8370bb6e666bb10))

## [0.21.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.20.0...app-v0.21.0) (2026-07-20)


### Features

* **streak:** let 1 sandhya complete the day, add Temple Visit practice ([cfd4bbf](https://github.com/HunterSreeni/nithyakarma-tracker/commit/cfd4bbf03edcdac2aeade9f9cc113e5a37257675))

## [0.20.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.19.0...app-v0.20.0) (2026-07-20)


### Features

* **learning:** add a general monthly-specials framework, seed Karkidakam ([20d3f3b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/20d3f3ba85caaf55bb73cc5e629c87fce3cda1d2))
* **learning:** add Vishnu Sahasranamam, rebuild Hanuman Chalisa from real sources ([67477c8](https://github.com/HunterSreeni/nithyakarma-tracker/commit/67477c83a786a3807291149569bd9c315c69e41b))
* **learning:** decouple reading from completion, add a content hub ([77a42f4](https://github.com/HunterSreeni/nithyakarma-tracker/commit/77a42f4c845af091f6032b795bbdac9f83659b68))
* **share:** share the streak card as an image, not just text ([b2b037a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b2b037acdb3069acad03d5486dbfb332a3701456))


### Bug Fixes

* **panchangam:** label the kalam windows as IST ([19544b9](https://github.com/HunterSreeni/nithyakarma-tracker/commit/19544b99c9e600f19504f63dee681ed09a92d97d))
* **panchangam:** switch Tamil month-start to the sunset rule ([0ad155a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0ad155a12a4cf327d9c9eb45fc7506543f82fdb9))
* **test:** mock useLearning in LearningHub test to avoid real supabase import ([672297b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/672297b375a2fef04cca71b48480d2478c9c86c0))

## [0.19.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.18.2...app-v0.19.0) (2026-07-20)


### Features

* **site:** add static marketing site for nithyakarma.org ([7845062](https://github.com/HunterSreeni/nithyakarma-tracker/commit/784506297669e679373fa0c9d781ca1d627ff657))


### Bug Fixes

* gate the celebration modal on a real streak, fix a punya typo ([1b42a8b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/1b42a8bdfc9943c8d1de8fb6caf55770f324d696))

## [0.18.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.18.1...app-v0.18.2) (2026-07-20)


### Bug Fixes

* revalidate cached Learning content instead of caching it forever ([dcd007e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/dcd007e945628cf8594d9303bf55c51041b1a86a))
* stop a learning practice permanently blocking the daily streak ([7bb8311](https://github.com/HunterSreeni/nithyakarma-tracker/commit/7bb83118399bc8ee2036b157f2cee2a4cdb34808))

## [0.18.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.18.0...app-v0.18.1) (2026-07-19)


### Bug Fixes

* self-host Sora and DM Sans so the CSP stops blocking them ([ca49fa6](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ca49fa671e6d0519b81257a473fc288a3caaa2b7))
* stop Capacitor echoing OAuth tokens into logcat ([0e87021](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0e870211b7e3b0d0f36d16ce3fe04c7f82cf2ecb))

## [0.18.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.17.0...app-v0.18.0) (2026-07-18)


### Features

* add About and Karma-calculation info pages ([c1725db](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c1725db0a5455574550d750d6300e77f9d4e6821))
* rename Android applicationId and drop Sreeniverse branding ([1019981](https://github.com/HunterSreeni/nithyakarma-tracker/commit/101998152e4ded8779e006106c0601f8f9a15ac0))
* show native-script month names in the panchangam box ([502dd3e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/502dd3eb135d48577c433f3e000c6c49e1edc059))
* wire Cloudflare Turnstile captcha into the auth flow ([21eca2e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/21eca2ef6ad115fea2be478bd1e152ea5c57f6b2))


### Bug Fixes

* deliver the 08:00 morning nudge that the slot CHECK silently blocked ([4499060](https://github.com/HunterSreeni/nithyakarma-tracker/commit/44990602407da1176e78639f8faf00ecd2f90c6f))
* move the Today-page panchangam box below the Namaskaram greeting ([0f917c2](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0f917c2d8a00018089591d051324fb1478e27521))

## [0.17.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.16.0...app-v0.17.0) (2026-07-17)


### Features

* add haptic feedback to the celebration modal (Intent 2.2, partial) ([b60a03f](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b60a03f30237603b80b10cb9e56bc2182dec95cb))

## [0.16.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.15.4...app-v0.16.0) (2026-07-17)


### Features

* animate the celebration modal, recolor topbar/referral card to saffron ([dd4504e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/dd4504e062bfc359b32ed46645e93b4945e54d71))


### Bug Fixes

* derive Android versionCode from versionName instead of hardcoding it ([6115599](https://github.com/HunterSreeni/nithyakarma-tracker/commit/61155997ea83ea2b7d725b9f33eb546d7c3e4ac2))

## [0.15.4](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.15.3...app-v0.15.4) (2026-07-17)


### Bug Fixes

* resolve ambiguous score/streak column reference breaking get_leaderboard ([2587486](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2587486967cc819a9086b0d5cda2dd0d0c81da6a))
* stop verse-learning marks from driving streaks; weight punya by effort ([c1590be](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c1590befac6ae774f89ee9216922a4536dfc73ab))
* verse-learning streak exploit, effort-weighted punya, broken leaderboard ([c99e65d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c99e65d0f86aa8c614f24418994e012436bef25d))

## [0.15.3](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.15.2...app-v0.15.3) (2026-07-17)


### Bug Fixes

* compute streak completion from the caller's local date, not server UTC ([41d8409](https://github.com/HunterSreeni/nithyakarma-tracker/commit/41d8409225af7ed7fa6bce19f424a877028a5dbd))
* harden Android backup settings; add Netlify security headers ([df4fdfb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/df4fdfb69e1b6ccb818698b76cd511f0090ebb2b))
* hide zero-score profiles from the leaderboard ([cd0403a](https://github.com/HunterSreeni/nithyakarma-tracker/commit/cd0403a991f4ddc80c5fe926e409c79840652b3a))
* make leaderboard visibility opt-in instead of opt-out ([f9782f0](https://github.com/HunterSreeni/nithyakarma-tracker/commit/f9782f01517cebf6b209e046633ab5e5c93c130a))
* normalize the deprecated Asia/Calcutta timezone alias before storing ([1ec6193](https://github.com/HunterSreeni/nithyakarma-tracker/commit/1ec6193986054e5c11c21839134ea8a9c6e09c8f))
* pluralize "day(s)" in the celebration modal ([96c1371](https://github.com/HunterSreeni/nithyakarma-tracker/commit/96c137129abdab703112898b39d509d4fad1085b))
* raise a local notification for foreground push receives on Android ([dbdd386](https://github.com/HunterSreeni/nithyakarma-tracker/commit/dbdd386dbcc1610f2162dab1d356341504c7c910))
* raise Auth password minimum to 8 chars ([393914f](https://github.com/HunterSreeni/nithyakarma-tracker/commit/393914f17391209760fd5aef82900f4829d9996a))
* rate-limit apply_referral against ad-free/freeze farming ([9a2be8c](https://github.com/HunterSreeni/nithyakarma-tracker/commit/9a2be8c1ed909b71c854d8dd5091afe22d896e5a))
* restore search_path on tier_for ([ccdc3d2](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ccdc3d229ac63b23f7eb98df498526f816715492))
* security/bug batch from the 2026-07-16 project analysis ([4023038](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4023038e6cc93ca4abee3c2bf4f009fbcf30f424))


### Performance Improvements

* lazy-load the first-run guided tour ([ed6811e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ed6811e11ed6b2b17027fccab79d704c156bd271))

## [0.15.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.15.1...app-v0.15.2) (2026-07-16)


### Bug Fixes

* Learning page Sanskrit tab shows real Devanagari script ([a3627ed](https://github.com/HunterSreeni/nithyakarma-tracker/commit/a3627edc54ae0fd2ba98bcf6dd7db35bda2f3f98))
* Learning page Sanskrit tab shows real Devanagari script ([baad901](https://github.com/HunterSreeni/nithyakarma-tracker/commit/baad9016f4d886c52b46de684f26ec852ab87140))

## [0.15.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.15.0...app-v0.15.1) (2026-07-16)


### Bug Fixes

* Learning content shows real verses, not translations ([56505e7](https://github.com/HunterSreeni/nithyakarma-tracker/commit/56505e7718a7348ecfef914d98683eac21287a86))
* local notification completion + Learning content is real verses, not translations ([b55dc4b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b55dc4bcc6e50a531f84871bd65d081cbf42cd93))
* local notification respects day completion (closes Intent 1.2) ([a2e2608](https://github.com/HunterSreeni/nithyakarma-tracker/commit/a2e260821e44390623ce0e4176873c6180ef1557))

## [0.15.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.14.1...app-v0.15.0) (2026-07-16)


### Features

* Learning page pilot - Hanuman Chalisa verse-by-verse (Intent 2.1a) ([8796d27](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8796d274f4e615042bab56e378ead49b44a70736))
* Learning page pilot - Hanuman Chalisa verse-by-verse (Intent 2.1a) ([cc4fb29](https://github.com/HunterSreeni/nithyakarma-tracker/commit/cc4fb296a99311d8713798c74d1182c358111005))
* native Google Sign-In deep link (Intent 1.7) ([9fca547](https://github.com/HunterSreeni/nithyakarma-tracker/commit/9fca5479cd73251f3649ced85e5edafa0d8724c3))
* native Google Sign-In deep link (Intent 1.7) ([bb2643d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/bb2643d2b0b6b8d43c1affd54d7952e04a08346a))
* Today page panchangam info box (Intent 2.7) ([15e9d95](https://github.com/HunterSreeni/nithyakarma-tracker/commit/15e9d9515c091b2f9fd501ddf2660ba78db73394))
* Today page panchangam info box (Intent 2.7) ([88d5413](https://github.com/HunterSreeni/nithyakarma-tracker/commit/88d5413e15c41032b20f21e59fb78a548d476f37))


### Bug Fixes

* drop unneeded storage.objects SELECT policy on learning-content ([833f89d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/833f89d8f8e24a661c48900dbe74ed57c8d40cea))

## [0.14.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.14.0...app-v0.14.1) (2026-07-15)


### Bug Fixes

* pluralize "day(s)" on the Today streak card ([4c4d2c6](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4c4d2c670c4a63922b2b86bf614c07bfcadc392d))

## [0.14.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.13.0...app-v0.14.0) (2026-07-15)


### Features

* rename obscure tier names to more recognizable Vedic terms ([d049cf5](https://github.com/HunterSreeni/nithyakarma-tracker/commit/d049cf50ff249207dd3240636a50df6b84c79e1e))
* replace all emoji with a real icon system, swap Syne for Sora ([0f2d7aa](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0f2d7aa79fd72ba45b4af25eaf70d52e528ff817))


### Bug Fixes

* android-sandhya.sh never actually cleared app data before login ([d09588b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/d09588ba2d4dcd59d3c25d719fdd4bb4b74cc1d5))

## [0.13.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.12.0...app-v0.13.0) (2026-07-15)


### Features

* split Referrals into its own tab, make Community opt-in (default off) ([6035d8d](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6035d8da7fa819b3a041fcd50ffdaf6e68dcaad4))


### Bug Fixes

* require typing the account email (not the word DELETE) to confirm deletion ([4bcacb0](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4bcacb07abfb952c00c7ef785e97793695173c46))

## [0.12.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.11.2...app-v0.12.0) (2026-07-15)


### Features

* rename Sabha Friends tab to Referrals, add join-date tracking ([4f8cd91](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4f8cd91241ab2f4cd88a960a4798985a5a14bf6e))


### Bug Fixes

* clear stale rows on Sabha tab switch to avoid mis-keyed render ([3eb07c7](https://github.com/HunterSreeni/nithyakarma-tracker/commit/3eb07c7e90c3427228b1f649e42a40914a11b4fa))
* close the accessibility (WCAG 2.1 AA) gaps in TEST-PLAN.md ([26e56bc](https://github.com/HunterSreeni/nithyakarma-tracker/commit/26e56bce5f3a6b0abf5d33999b824c339a47b4dd))

## [0.11.2](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.11.1...app-v0.11.2) (2026-07-14)


### Bug Fixes

* register @capacitor/app in Android Gradle project; document Android testing ([abe5a29](https://github.com/HunterSreeni/nithyakarma-tracker/commit/abe5a295a29b860572a49a4a628fb559b8f44614))
* register @capacitor/app in the Android Gradle project; document Android testing setup ([d2cbbef](https://github.com/HunterSreeni/nithyakarma-tracker/commit/d2cbbef7f02536c273f14916972088d91f1adb19))

## [0.11.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.11.0...app-v0.11.1) (2026-07-14)


### Bug Fixes

* web push service worker never registered + test-notification CORS ([8462cab](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8462cab8c46137352c3c9833e73a7b636a9ae42d))

## [0.11.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.10.1...app-v0.11.0) (2026-07-14)


### Features

* notification self-heal + on-demand test push ([50a4180](https://github.com/HunterSreeni/nithyakarma-tracker/commit/50a4180a855544265e301e06cc5b6cae4cada868))

## [0.10.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.10.0...app-v0.10.1) (2026-07-14)


### Bug Fixes

* mock lib/supabase in App.test.jsx to fix CI ([414c992](https://github.com/HunterSreeni/nithyakarma-tracker/commit/414c9923fdb53593c9c79753ef3d8a18787752c9))
* remove diya branding, fix push notifications, fix stuck-loading bug ([56c34a8](https://github.com/HunterSreeni/nithyakarma-tracker/commit/56c34a8daa48e13a8019bce3abcbacd608c07537))
* remove diya branding, fix push notifications, fix stuck-loading bug ([9a84e3e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/9a84e3efebaa1efae047ed753f12bffe233a378f))

## [0.10.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.9.0...app-v0.10.0) (2026-07-12)


### Features

* ad before celebration + cap + G-rated ads (Intent 0.2 code) ([2720c58](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2720c581fb3a6b8ccddb9aa174569a361f2770c4))
* ad before celebration + session cap + G-rated ads (Intent 0.2 code) ([1780c48](https://github.com/HunterSreeni/nithyakarma-tracker/commit/1780c4819a7ca1a7820dfb7185cb584d042ca514))

## [0.9.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.8.0...app-v0.9.0) (2026-07-12)


### Features

* onboarding value-prop intro (Intent 0.6) ([23cbb0b](https://github.com/HunterSreeni/nithyakarma-tracker/commit/23cbb0b040fa395c5fd79d5e5fa44d389e0f17cf))
* onboarding value-prop intro before the form (Intent 0.6) ([68c0ebd](https://github.com/HunterSreeni/nithyakarma-tracker/commit/68c0ebda655ee50edbbf38163fa615b03c0b7d89))

## [0.8.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.7.1...app-v0.8.0) (2026-07-12)


### Features

* password reset / recovery (Intent 0.3) ([0a48501](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0a4850127c2546604dad80b692d5041b5756a367))
* password reset / recovery flow (Intent 0.3) ([af066de](https://github.com/HunterSreeni/nithyakarma-tracker/commit/af066de32fd3165618e28b417e5f136b655d4b41))

## [0.7.1](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.7.0...app-v0.7.1) (2026-07-12)


### Bug Fixes

* accessibility - WCAG AA contrast + larger text (Intent 0.4) ([83d6148](https://github.com/HunterSreeni/nithyakarma-tracker/commit/83d6148236acc30574c78a562a1164bc2c4416be))
* accessibility pass - WCAG AA contrast + larger text (Intent 0.4) ([0e6cba0](https://github.com/HunterSreeni/nithyakarma-tracker/commit/0e6cba08284d5098e60ec3fe396649266a1a10c8))

## [0.7.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.6.0...app-v0.7.0) (2026-07-12)


### Features

* invite CTA on Friends tab (Intent 1.6) ([c539fe2](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c539fe2d469651fd6e772c5f14ab1cdaf9f556d2))
* invite CTA on the Friends tab when you have no connections (Intent 1.6) ([09c15cd](https://github.com/HunterSreeni/nithyakarma-tracker/commit/09c15cdfdc61a5bd43094ce42b9a4557102b5302))

## [0.6.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.5.0...app-v0.6.0) (2026-07-12)


### Features

* one-tap suggested practices on empty Today (Intent 1.5) ([c752423](https://github.com/HunterSreeni/nithyakarma-tracker/commit/c75242396627ba4a7e1708de02ec27be12d73d19))
* one-tap suggested practices on the empty Today screen (Intent 1.5) ([b6698bc](https://github.com/HunterSreeni/nithyakarma-tracker/commit/b6698bcbc63cd3a114793dc4493104ab4ce5c1e6))

## [0.5.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.4.0...app-v0.5.0) (2026-07-12)


### Features

* in-app review prompt at streak milestones (Intent 1.4) ([82f0040](https://github.com/HunterSreeni/nithyakarma-tracker/commit/82f004063bbd89d71b32ada5f3e41ccdf90b4e79))
* in-app review prompt at streak milestones (Intent 1.4) ([4692c11](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4692c11b171020af08f41bf26fe729bababf79f3))

## [0.4.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/app-v0.3.0...app-v0.4.0) (2026-07-12)


### Features

* first-party analytics + Sentry crash reporting (Intent 1.3) ([2f8ace2](https://github.com/HunterSreeni/nithyakarma-tracker/commit/2f8ace27485ac9478650ec517e4a374a5e284345))
* first-party analytics + Sentry crash reporting (Intent 1.3) ([7e01e9e](https://github.com/HunterSreeni/nithyakarma-tracker/commit/7e01e9e4cd0eba82bbb7658f87ac1876a212e5b6))
* show app version on the profile screen ([6277afb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6277afb56b5aadf9f414c63a1bf9d61994e1b147))
* streak freeze tied to tier + referrals (Intent 1.1) ([ab10ded](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ab10ded140b4b90fff7ec2b72b90903a23b7e19c))
* streak freeze tied to tier and referrals ([4bba27c](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4bba27ce16f9cde33f091f7f9f79640626a16a8a))


### Bug Fixes

* exclude destructive e2e journey from CI ([8b08411](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8b08411b1c0e1a191bdc5dd2ed072f6679708421))

## [0.3.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/v0.2.0...v0.3.0) (2026-07-12)


### Features

* streak freeze tied to tier + referrals (Intent 1.1) ([ab10ded](https://github.com/HunterSreeni/nithyakarma-tracker/commit/ab10ded140b4b90fff7ec2b72b90903a23b7e19c))
* streak freeze tied to tier and referrals ([4bba27c](https://github.com/HunterSreeni/nithyakarma-tracker/commit/4bba27ce16f9cde33f091f7f9f79640626a16a8a))

## [0.2.0](https://github.com/HunterSreeni/nithyakarma-tracker/compare/v0.1.0...v0.2.0) (2026-07-12)


### Features

* show app version on the profile screen ([6277afb](https://github.com/HunterSreeni/nithyakarma-tracker/commit/6277afb56b5aadf9f414c63a1bf9d61994e1b147))


### Bug Fixes

* exclude destructive e2e journey from CI ([8b08411](https://github.com/HunterSreeni/nithyakarma-tracker/commit/8b08411b1c0e1a191bdc5dd2ed072f6679708421))
