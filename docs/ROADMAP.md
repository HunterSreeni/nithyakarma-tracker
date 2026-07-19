# Nithyakarma - Roadmap

Product ideas beyond the current feature set. The current release scope and its
test coverage live in `TEST-PLAN.md`; this file is for what comes next. Each item
needs its own design + test pass when picked up.

> **For how the system works today**, see `docs/architecture/` - a verified reference
> for the database, RPCs, edge functions, frontend, Android and panchangam pipeline.
> `docs/architecture/09-STATUS-LEDGER.md` records what is actually built versus planned.
> Start there rather than scanning the codebase.

## Domain and public identity

**`nithyakarma.org` was registered on 2026-07-19.** Nothing is pointed at it yet.

Planned layout:

| Host | Serves | Status |
|---|---|---|
| `nithyakarma.org` | Marketing site - About as the landing page, features, karma explainer, roadmap, reviews | Not built |
| `app.nithyakarma.org` | The existing React app | Not pointed |
| `nithykarma.netlify.app` | Current app origin - **keep alive and 301-redirecting** | Live |

> ### ⚠️ Do not retire the Netlify origin
>
> Web push subscriptions are keyed to the **origin** that created them. The three live
> rows in `push_subscriptions` with `platform='web'` are bound to
> `nithykarma.netlify.app`. If that host stops resolving, those subscriptions die
> silently and those users simply stop receiving push with no error anywhere.
>
> Note the existing origin is **misspelled** (`nithykarma`, missing the second `a`).
> That is part of why the domain matters, and also why the redirect has to stay.

Migration checklist when this is picked up:

- Add both new origins to the Supabase Auth redirect allow-list
- Update the CSP `connect-src` in `app/netlify.toml` (currently hardcoded to the
  Supabase origin) - and mind that **two `netlify.toml` files exist**; the root one
  sets `base = "app"` and carries no headers block, `app/netlify.toml` carries the real
  CSP and HSTS. Splitting into two Netlify sites risks silently dropping the headers
- Swap `CONTACT` in `src/components/LegalPages.jsx` from `support@sreeniverse.co.in`
  to `support@nithyakarma.org` - the last intentional Sreeniverse reference in the app
- Update `APP_URL` in `supabase/functions/_shared/push.ts`, which is what push
  notifications deep-link to
- Update the Play Store listing URLs

### support@nithyakarma.org

A **free** Gmail account cannot own a custom domain - that needs Google Workspace
(paid per user). Two free routes exist instead:

| Option | Receives | Sends as support@ | Catch |
|---|---|---|---|
| **Zoho Mail free** | Yes | Yes | 5 users, 5GB each, 1 domain, **no IMAP/POP** so no Outlook/Apple Mail |
| **Cloudflare Email Routing** → existing Gmail | Yes | **No** - inbound only | Needs a separate SMTP relay for Gmail "Send mail as"; requires DNS on Cloudflare |

Zoho is the simpler single answer if support@ needs to send replies. Cloudflare is
better if forwarding into an existing inbox is enough and sending can wait.

## Phase 2 (post first Play Store release)

### Thithi-based observances (lunar days)
- Add practices tied to lunar days (thithis), not just daily/weekly ones:
  **Amavasya** (new moon), **Pournami / Purnima** (full moon), **Ekadashi**,
  **Pradosham**, **Sankatahara Chaturthi**, **Shashti**, etc.
- Needs a new **thithi-aware cadence** (e.g. `thithi`) alongside the existing
  daily / weekly / sequence / daily_count. Scheduling + reminders fire only on
  the matching thithi (depends on the panchangam calc below).
- Example practices: Amavasya tarpanam, Pournami puja, Ekadashi upavasam.
- Test impact: new cadence in `utils/cadence`, new scheduling in the submit RPC
  and reminders edge function, unit + integration coverage for thithi matching
  across timezones.

### Temple visit tracking (deferred - later phase)

> Raised 2026-07-18, explicitly deferred to a later phase. Captured here so the
> design constraints are not re-derived later.

- Marking "visited a temple" should let the user pick **which** nearby temple, not just
  record a generic visit. That means device location plus a place-data source, and
  probably a static map snapshot.
- **Place-data source: open-source only** (decided). Options to evaluate:
  **OpenStreetMap** via the Overpass API (`amenity=place_of_worship` +
  `religion=hindu`) - free, no key, no billing, though small-temple coverage in South
  India is patchy; **Bhuvan** (ISRO, genuinely India-focused); **MapmyIndia** free tier.
  Static tiles from OSM or Protomaps avoid Google Maps billing entirely. A
  user-submitted temple list is a third path that builds a real community asset but
  starts empty and needs moderation.
- **Play Data Safety impact:** requires `ACCESS_COARSE_LOCATION`. Location is a
  sensitive category, so this forces a re-declaration and materially changes the
  listing disclosure. The app currently declares only `INTERNET` and
  `POST_NOTIFICATIONS` - see `docs/architecture/06-ANDROID.md`.
- **Open design question, settle before building:** does a temple visit feed the
  existing daily streak, or is it a parallel streak? Feeding the existing one risks
  diluting what the nitya karma streak means.
- Schema sketch: `temples (id, name, lat, lon, source, verified)` and
  `temple_visits (owner_id, family_member_id, temple_id, visited_at, log_date)`.
  Note `temple_visits` needs `on delete cascade` back to `profiles`, or
  `delete_account` will orphan rows.

### Panchangam / calendar integration
- A calendar view showing the daily panchangam - **thithi**, nakshatra, and the
  special observance days highlighted - and driving the thithi-based scheduling
  and reminders above.
- Data source to evaluate: client-side astronomical panchangam calculation
  (sunrise-based, location + timezone aware) vs a maintained data source.
  Accuracy for the user's region is the key requirement (thithis roll over at
  local sunrise, not midnight).
- **Language / script switch for the calendar: Malayalam <-> Sanskrit** for
  thithi / nakshatra / month names. Sanskrit must stay **romanized** (per the
  app's existing convention - never Devanagari). Structure it so more regional
  calendars/scripts (e.g. Tamil) can be added later.
- Test impact: calc correctness across a year of known dates + locales, the
  language toggle, and a11y of the calendar grid.
- **Related, smaller, nearer-term:** `docs/UPGRADE-PLAN.md` Intent 2.7 scopes a
  standalone Today-page panchangam info box (thithi, nakshatra, kalams,
  Tamil/Malayalam month+day, varsham name) - a narrower slice of this same data
  problem. Whichever data source (API vs. self-computed) and regional
  convention gets picked there should be reused here, not decided twice.
