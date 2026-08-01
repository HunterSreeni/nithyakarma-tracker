# 7-inch tablet screenshots

Captured 2026-07-28 from a locally-created `tablet7` AVD (device profile "7in WSVGA
(Tablet)", Android 16/API 36, reusing the already-installed
`google_apis_playstore` x86_64 system image) running the signed 0.29.1 release
APK. 1024x600, no alpha - within Play's 320-3840px per-side spec.

Signed in as the `e2e@nithyakarma.test` fixture account (kept live specifically
for cases like this - see project memory). Screenshots show its real,
already-accumulated practice history rather than fabricated data. The tablet
layout uses a horizontal top-nav and a 2-column card grid instead of the
phone's bottom tab bar and single column - `01-today.png` in particular shows
that responsive layout directly.

- `01-today.png` - Today page scrolled to the streak card + 2-column
  Sandhyavandhanam/Hanuman Chalisa anushtanam cards.
- `02-learning.png` - Learning hub's Read Along list.
- `03-profile.png` - Profile page: tier progress, streak/best/punya stats.
- `04-history.png` - Practice history across several real logged days.

Sabha was skipped - like the phone set, only one real user (this account) has
opted in, so the leaderboard is a single sparse row. History was used instead
for a fuller-looking 4th screenshot.
