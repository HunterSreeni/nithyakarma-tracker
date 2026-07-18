# Nithyakarma - Roadmap

Product ideas beyond the current feature set. The current release scope and its
test coverage live in `TEST-PLAN.md`; this file is for what comes next. Each item
needs its own design + test pass when picked up.

> **For how the system works today**, see `docs/architecture/` - a verified reference
> for the database, RPCs, edge functions, frontend, Android and panchangam pipeline.
> `docs/architecture/09-STATUS-LEDGER.md` records what is actually built versus planned.
> Start there rather than scanning the codebase.

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
