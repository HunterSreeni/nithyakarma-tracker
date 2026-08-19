# Nithyakarma - Roadmap

Product ideas beyond the current feature set. The current release scope and its
test coverage live in `TEST-PLAN.md`; this file is for what comes next. Each item
needs its own design + test pass when picked up.

> **For how the system works today**, see `docs/architecture/` - a verified reference
> for the database, RPCs, edge functions, frontend, Android and panchangam pipeline.
> `docs/architecture/09-STATUS-LEDGER.md` records what is actually built versus planned.
> Start there rather than scanning the codebase.

> ### Release status: LIVE on Google Play production (first real-user release)
>
> **19 Aug 2026:** the closed-testing build (`0.31.7`) was promoted to the Production
> track, approved by Google, and is now Active - 177 countries/regions worldwide.
> **This is the app's first real-user release** - treat infra/DNS/config changes
> accordingly from this point on, including in-flight Supabase migrations/edge
> function deploys (no longer purely developer test data). Catalogue access
> preference is set to "do not publish to third-party app stores" for now (Play
> Console - Settings - Catalog Settings, can be changed later). IARC content rating
> live the same day, Global Rating ID `e66863d6-9c92-86a6-8290-3f7dbfc189d6`. iOS is
> a later phase (Phase 3), not started.
>
> Play Console flagged 3 recommended (non-blocking) actions on this release: edge-to-
> edge deprecated APIs, R8/mapping optimization (tracked as Intent R5, deferred - see
> `docs/UPGRADE-PLAN.md`), see status ledger for the edge-to-edge investigation.
>
> The developer's own testing accounts remain in use for verification
> (`e2e@nithyakarma.test`, `e2efull@nithyakarma.test`, etc. - see memory
> `e2e-account-keep`) alongside real installs now arriving.

## Domain and public identity

**`nithyakarma.org` was registered on 2026-07-19.** Nothing is pointed at it yet.

Planned layout:

| Host | Serves | Status |
|---|---|---|
| `nithyakarma.org` | Marketing site - About as the landing page, features, karma explainer, support us | **Live** (23 July 2026) - Cloudflare CNAME to `tranquil-jalebi-88d0eb.netlify.app`, proxied, Full SSL |
| `app.nithyakarma.org` | The existing React app | **Live** (23 July 2026) - Cloudflare CNAME to `nithykarma.netlify.app`, proxied, added as Netlify custom domain (not a redirect - both origins serve the same site) |
| `nithykarma.netlify.app` | Current app origin - **kept alive**, no redirect added | Live |

> ### Keep the Netlify origin alive when this is picked up
>
> Web push subscriptions are keyed to the **origin** that created them. The handful of
> rows in `push_subscriptions` with `platform='web'` are bound to `nithykarma.netlify.app`
> - but since there are no production users yet, these are the developer's own test
> subscriptions, not a live-user risk. Still worth keeping the origin alive rather than
> retiring it outright, purely so testing continuity isn't broken for no reason - add
> `app.nithyakarma.org` as an *additional* domain on the same Netlify site rather than
> replacing `nithykarma.netlify.app`.
>
> Note the existing origin is **misspelled** (`nithykarma`, missing the second `a`).
> That is part of why the domain matters.

Migration checklist:

- ~~Add both new origins to the Supabase Auth redirect allow-list~~ - done 2026-07-23,
  `https://app.nithyakarma.org/**` added alongside the existing `nithykarma.netlify.app`
  entry (dashboard-only, no MCP tool covers Auth config)
- ~~Update the CSP `connect-src` in `app/netlify.toml`~~ - checked 2026-07-23, no change
  needed: it only lists third-party origins (Supabase, Cloudflare Turnstile, Sentry),
  never the app's own domain, so it works unchanged regardless of which origin serves
  the page. Still mind that **two `netlify.toml` files exist**; the root one sets
  `base = "app"` and carries no headers block, `app/netlify.toml` carries the real CSP
  and HSTS
- ~~Swap `CONTACT` in `src/components/LegalPages.jsx` from `support@sreeniverse.co.in`
  to `support@nithyakarma.org`~~ - done 2026-07-20
- ~~Update `APP_URL` in `supabase/functions/_shared/push.ts`~~ - done 2026-07-23, now
  `https://app.nithyakarma.org`; `send-reminders` and `send-test-notification` redeployed
- Update the Play Store listing URLs - **not applicable yet**, no Play Store listing
  exists (see "Release status" callout)

### support@nithyakarma.org - done 2026-07-20

Domain nameservers moved to Cloudflare. Cloudflare Email Routing forwards
`support@nithyakarma.org` to the personal Gmail (`nithyakarmatracker@gmail.com`).
Sending as `support@` from Gmail's "Send mail as" uses **Gmail's own SMTP**
(`smtp.gmail.com:587`, primary Gmail address as username, a Google App Password) -
no third-party SMTP relay or Zoho needed. Both directions verified working.

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
  diluting what the nitya karma streak means. **Partial precedent as of 2 Aug 2026:** the
  plain "Temple Visit" checkbox practice (no location/map, shipped 20 July as
  `temple-visit`) already feeds the existing streak (`affects_streak = true`) - worth
  reusing that answer here unless this richer version is meant to be deliberately
  different.
- Schema sketch: `temples (id, name, lat, lon, source, verified)` and
  `temple_visits (owner_id, family_member_id, temple_id, visited_at, log_date)`.
  Note `temple_visits` needs `on delete cascade` back to `profiles`, or
  `delete_account` will orphan rows.

### Sandhyavandhanam / Samidhadhanam Learning content, per-Veda (deferred - researched 4 Aug 2026)

> Raised 4 Aug 2026 alongside the batch of 5 new Learning-tab texts (see
> [09-STATUS-LEDGER.md](architecture/09-STATUS-LEDGER.md)). Both practices ship with a
> watch-along YouTube video for now (`has_learning_content = true`, no verse content) -
> full reading content is this item, not yet built.

**Confirmed by research, not assumed:** Rigveda, Yajurveda, Samaveda and Atharvaveda each
have genuinely different mantras and step sequences for both rituals - not minor
variation, different Rishi lists and a different procedure per source. A single text
would be wrong for most readers outside whichever Veda it happened to represent, so
neither practice got full reading content in this batch, unlike the 5 stotras that did
(Dakshinamurthy Stotram, Aditya Hrudayam, Subrahmanya Bhujangam, Mukundamala, Sri
Rudram) - those are single fixed texts, universally the same regardless of the reader's
Veda.

**Sandhyavandhanam - sourcing is solid, but English-transliteration only:**

| Veda | Source | Coverage |
|---|---|---|
| Rigveda | archive.org, "Rigveda Sandhyavandanam" (Bharati Web) | Complete procedure (~11 pages: achamanam through gayatri japam). English only |
| Yajurveda | Shri Kainkaryam Kriya Trust (srikkt.org) | Complete, 22 numbered steps. English only |
| Samaveda | Same trust, srikkt.org | Complete, same step structure. English only |
| Atharvaveda | Transcription based on Sandhya Parishishta | Complete (achamanam/marjanam/etc). English + some Devanagari |

None of the four have the Devanagari + Malayalam + Tamil companion pages `vignanam.org`
gave for the 5 stotras above - wiring this as-is would be a step down in language parity
from everything else on the Learning tab. Getting regional-language versions would need a
second research pass per Veda. The Yajurveda source doesn't specify Krishna vs Shukla;
treat it as Krishna Yajurveda for consistency with the existing Avani Avittam
(`panchangam_observances`) content, which already assumes Krishna Yajurveda for this
app's audience, unless a Shukla-specific split is wanted too.

**Scale:** each Veda's procedure is 20-40+ distinct named steps. Four Vedas is closer to
100-150+ Learning-tab entries, not a quick follow-on to the 5-text batch above - budget
it as its own piece of work, likely with a Veda switcher (tabs) alongside the existing
language switcher.

**Samidhadhanam - real per-Veda mantras exist, but far harder to source cleanly than
Sandhyavandhanam:**

| Veda | Source | Status |
|---|---|---|
| Rigveda | Ashvalayana Grhyasutra (via dharmawiki.org) | Real Sanskrit+IAST+meaning, but embedded in a scholarly survey page, not a clean standalone liturgy |
| Yajurveda | stotranidhi.com has a dedicated page | **Telugu-only** - no English/Sanskrit/Tamil/Malayalam version exists on that site |
| Samaveda | Gobhila Grhyasutra referenced everywhere | Could not locate the actual mantra text itself online, only summaries describing it |
| Atharvaveda | - | No dedicated source found at all |

A Veda-neutral core mantra does exist and is well sourced (Atharva Veda 19.64 +
Agnivesya Grhyasutra 1.4.1, via dharmawiki.org, real Sanskrit+IAST+English) - offered as
an option 4 Aug 2026, declined in favor of deferring the whole practice rather than
shipping something not labeled per-Veda like everything else on the tab.

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
