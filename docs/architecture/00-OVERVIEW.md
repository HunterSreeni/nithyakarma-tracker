# 00 - System Overview

## What the app is

A daily-ritual (nitya karma) tracker for the South Indian Hindu tradition. Users track
observances such as Sandhyavandhanam, parayanam and japam, build streaks, earn punya and
climb a tier ladder. Parents can additionally track their children's observances
(Bala Sabha). Tamil and Malayalam surfaces sit alongside romanized Sanskrit.

App convention: **Sanskrit is always romanized, never Devanagari.** Tamil and Malayalam
month names render in their native scripts.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| UI | React 19.2 + Vite 8.1 | Plain JavaScript/JSX, no TypeScript |
| Routing | react-router-dom 7.18 | `BrowserRouter`, lazy route splitting |
| Backend | Supabase (Postgres 17.6) | Project `fkrifejzhnhknkuyhjhp`, region ap-northeast-1 |
| Auth | Supabase Auth | Email/password + Google OAuth |
| Serverless | Supabase Edge Functions (Deno) | `send-reminders`, `send-test-notification` |
| Scheduling | pg_cron + pg_net | One job, every 15 minutes |
| Mobile | Capacitor 8.4 (Android) | WebView wrapper, 9 plugins |
| Push | FCM (Android) + Web Push/VAPID (web) | Dual transport, one scheduler |
| Web host | Netlify | `nithykarma.netlify.app` (note: misspelled, see 09) |
| Domain | Registered 2026-07-19 | `nithyakarma.org` - **not pointed at anything yet**, see `ROADMAP.md` |
| Errors | Sentry (`@sentry/react` 10.65) | |
| Analytics | First-party, own Postgres table | No third-party vendor, no PII in props |
| Ads | AdMob via `@capacitor-community/admob` | Still on Google **test** IDs |
| Testing | Vitest + Testing Library + axe-core + Playwright | |
| Lint | oxlint | |
| Release | release-please, Conventional Commits | Auto SemVer, tag prefix `app-` |

## Repository layout

```
nithyakarma-tracker/
├── app/                        # everything shippable
│   ├── src/                    # React source
│   │   ├── components/         # 17 components + __tests__
│   │   ├── hooks/              # 6 hooks + __tests__
│   │   ├── utils/              # 15 utils + __tests__
│   │   ├── lib/supabase.js     # the single Supabase client
│   │   └── App.jsx             # routing + auth gate
│   ├── supabase/
│   │   ├── migrations/         # 31 SQL migrations
│   │   └── functions/          # Deno edge functions
│   ├── android/                # Capacitor Android project
│   ├── e2e/                    # Playwright specs
│   ├── scripts/                # panchangam generation, content
│   └── netlify.toml            # build + security headers
├── docs/                       # planning + this architecture tree
├── design-prototypes/
└── netlify.toml                # root: sets base = "app"
```

## Deploy topology

```
                    ┌─────────────────────────┐
                    │   Netlify (web app)     │
   Browser ────────►│  nithykarma.netlify.app │
                    │  CSP/HSTS headers       │
                    └───────────┬─────────────┘
                                │
   Android ──────┐              │  supabase-js
   (Capacitor    │              ▼
    WebView)     │   ┌──────────────────────────────┐
                 └──►│   Supabase (Postgres 17.6)   │
                     │  RLS on all 13 tables        │
                     │  13 RPCs (SECURITY DEFINER)  │
                     └────┬────────────────┬────────┘
                          │                │
              pg_cron every 15 min         │
                          │                │
                          ▼                ▼
              ┌──────────────────┐   ┌───────────┐
              │  send-reminders  │──►│  FCM      │──► Android
              │  (Deno edge fn)  │──►│  WebPush  │──► Browser
              └──────────────────┘   └───────────┘
```

## Core data flow: marking a practice done

1. `TodayPage.mark()` (or `LearningPage` on a verse learned) calls `submit()` from
   `hooks/useToday.js`
2. `useToday.submit()` calls the `submit_practice_log` RPC, passing the **client's local
   date** (`utils/cadence.localDateString`) so early-morning logging is not
   misattributed to the wrong server day
3. The RPC validates ownership and scheduling, inserts into `practice_logs`, awards
   punya, advances the per-practice streak, then evaluates whether **every scheduled
   practice for that subject** is complete today
4. If the day is complete, it runs `streak_after_completion` on the subject
   (`profiles` or `family_members`), consuming a freeze credit if exactly one day was
   missed, and tops freeze credits up on a tier-up
5. The RPC returns a JSON payload including `day_complete`, `freeze_used`, `punya`,
   `tier` and both streaks
6. The client shows `CelebrationModal`, fires the interstitial ad (if not ad-free),
   may request an in-app review at a milestone, and calls
   `suppressTodayNudgesIfScheduled()` to cancel today's local nudges

The single write path through one SECURITY DEFINER RPC is deliberate: `practice_logs`
has **no INSERT policy at all**, so logs cannot be forged from the client.

## Key invariants

- **All writes to `practice_logs` go through `submit_practice_log`.** There is no client
  INSERT path (verified: no INSERT policy on the table).
- **Sanskrit is romanized.** Never render Devanagari.
- **Ads never fire on a failed save.** See `TodayPage` and `utils/ads.js`.
- **Sandhyavandhanam is male-only**, and for children additionally requires
  `upanayanam_done` - enforced by the `check_sandhya_eligibility` trigger, not just the UI.
- **A day is complete only when every scheduled practice is done**, and for
  Sandhyavandhanam that means all three slots.
- **Panchangam data is precomputed annually**, never calculated per request.

## Related

- Database detail: [01-DATABASE.md](01-DATABASE.md)
- The RPC behaviour summarized above: [02-RPCS.md](02-RPCS.md)
- Push architecture: [07-NOTIFICATIONS.md](07-NOTIFICATIONS.md)
