# Changelog

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
