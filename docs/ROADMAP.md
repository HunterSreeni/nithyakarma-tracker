# Nithyakarma - Roadmap

Product ideas beyond the current feature set. The current release scope and its
test coverage live in `TEST-PLAN.md`; this file is for what comes next. Each item
needs its own design + test pass when picked up.

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
