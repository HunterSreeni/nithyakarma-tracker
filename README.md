# Nithyakarma

A daily tracker for nitya karma anushtanam - Sandhyavandhanam, parayanam, japam, and the practices that go with them, kept for the Hindu, Brahmin tradition.

**Live:** [nithyakarma.org](https://nithyakarma.org) · **Web app:** [app.nithyakarma.org](https://app.nithyakarma.org)

## Why

Keeping up a daily practice is easy to start and easy to quietly let slip. There was no tool built for this specific tradition that made it easy to see, at a glance, what's done and what's not - so this exists to fix that.

## What it does

- **Sandhyavandhanam, done right** - mark all three sandhyas (Prathakala, Madhyanika, Saayamkala) plus Gaayatri japam; the day only counts complete when all three are marked, same as the real practice
- **Parayanam tracking** - Vishnu Sahasranamam, Lalitha Sahasranamam, Hanuman Chalisa, Narayaneeyam, Bhagavad Gita, Aditya Hrudayam, Sri Rudram, and more - daily, weekly, count-based, or sequence practices that track chapter/dasakam progress on their own
- **Streaks that respect a missed day** - earn streak freezes as you climb tiers (Shishya to Brahmarishi), so one off day doesn't erase months of practice
- **Hanuman Chalisa, verse by verse** - read along in English, Malayalam, or Sanskrit
- **Daily panchangam** - thithi, nakshatram, varsham, Rahu/Yamagandam/Gulika kalam, right on the daily screen
- **Family tracking** - add children under 15 and mark their anushtanams, with an optional first-name-only kids' leaderboard
- **Sabha (optional community)** - compare streak and punya with others, off by default
- **Invite friends** - share a link, both sides get ad-free days and a streak freeze on signup

## Status

- **Web** - live at [app.nithyakarma.org](https://app.nithyakarma.org)
- **Android** - **live** on Google Play production, 19 Aug 2026 (worldwide, 177 countries/regions); AdMob linked and ad-serving verified live, 20 Aug 2026
- **iOS** - planned

## Tech stack

- React 19 + Vite (JavaScript)
- Capacitor 8 for the Android/iOS shell
- Supabase for auth, data, and backend
- Sentry for error tracking, Vitest + Playwright for testing

## Repo layout

- `app/` - the React + Capacitor application (web, Android, iOS)
- `site/` - the static marketing site (nithyakarma.org)
- `docs/` - architecture notes, roadmap, release readiness, test plans

## Privacy

Your account, and everything in it, can be deleted for real, at any time. Data is never sold or shared with advertisers beyond what's needed to serve ads.

---

Built and maintained by [HunterSreeni](https://hunter-sreeni.netlify.app).
