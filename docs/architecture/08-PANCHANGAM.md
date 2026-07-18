# 08 - Panchangam Data Pipeline

The Today page shows the day's panchangam: varsham name, Tamil and Malayalam month+day,
thithi, nakshatra, and the three inauspicious windows.

## Design principle: precompute annually, never per request

A year's panchangam is **constant once computed**. So one script computes all ~365 rows,
they are reviewed, then loaded into `panchangam_days` once. The Today page does a
single-row lookup by date.

Zero ongoing API cost, zero astronomical computation per page load, and the data can be
audited before it ever reaches a user - which matters for ritual timing, where a wrong
Rahu Kalam is a visible error to a knowledgeable user.

## Generation

`app/scripts/generate-panchangam.cjs`, run manually:

```bash
node scripts/generate-panchangam.cjs 2027
```

Output goes to `scripts/panchangam-<year>.json` for review. **It is deliberately not
auto-inserted** - the Intent 2.7 gate requires validation against a real panchangam
before going live.

### Method

**Drik ganita** (true sidereal positions), Lahiri ayanamsa, via `swisseph-v2`
(Swiss Ephemeris bindings).

| Value | How it is derived |
|---|---|
| Reference location | Kochi, Kerala - 9.9312 N, 76.2673 E |
| Sampling moment | Local solar noon (`jd = swe_julday(y, m, d, 12 - LON/15)`) |
| Nakshatra | `floor(moonLon / (360/27))` over 27 names |
| Thithi | `floor(((moonLon - sunLon) mod 360) / 12)`; index < 15 is Shukla paksha, else Krishna. Index 14 in each paksha renders as **Purnima** or **Amavasya** rather than "Chaturdashi" |
| Solar month | `floor(sunLon / 30)` gives the rashi, indexing both the Tamil and Malayalam month tables |
| Month day | Days elapsed since the rashi last changed (sidereal ingress / sankranti) |
| Sunrise / sunset | NOAA/Meeus low-precision solar position - self-contained, no ephemeris dependency, independently verifiable |
| Rahu / Yamagandam / Gulika | Daylight split into 8 equal parts; a published weekday→part table selects the window |

### Tamil and Malayalam months share one computation

Both are **solar** calendars driven by the same sidereal ingress. The script indexes two
different name tables off the same `rashi`, and both carry the same day number. This is
correct for the solar reckoning, and it is why adding more regional solar calendars is a
name-table change, not a new calculation.

| Rashi | Tamil | Malayalam |
|---|---|---|
| 0 | Chithirai | Medam |
| 1 | Vaikasi | Edavam |
| 2 | Aani | Mithunam |
| 3 | Aadi | Karkidakam |
| 4 | Aavani | Chingam |
| 5 | Purattasi | Kanni |
| 6 | Aippasi | Thulam |
| 7 | Karthikai | Vrischikam |
| 8 | Margazhi | Dhanu |
| 9 | Thai | Makaram |
| 10 | Maasi | Kumbham |
| 11 | Panguni | Meenam |

### Samvatsara (varsham) name

The 60-year cycle, indexed from `PARABHAVA_INDEX = 39` at `PARABHAVA_YEAR = 2026`, and
rolling over at **Mesha Sankranti** (South Indian solar reckoning, mid-April) rather than
Chaitra Shukla Pratipada (North Indian lunar reckoning, ~19 March).

> The solar convention was chosen deliberately: the household audience references
> **Pambu Panchangam**, a Tamil publication that uses solar reckoning. Using the lunar
> convention would flip the varsham name roughly a month early relative to the physical
> book users own.
>
> Also note **Prabhava** (1st in the cycle, 1987-88) and **Parabhava** (40th, 2026-27)
> are different years with near-identical names. The year starting April 2026 is
> **Parabhava**. Easy to mix up and visibly wrong to knowledgeable users.

## Storage

Loaded into `panchangam_days` (PK on `date`) via `mcp__supabase__execute_sql`. Readable
by any authenticated user; writes are service-role only.

Current contents: **365 rows covering 2026 only.**

## Client

- `hooks/usePanchangam.js` (21 lines) - fetches today's row
- `components/PanchangamBox.jsx` (26 lines) - renders it, below the Namaskaram greeting
- `utils/panchangamScript.js` - native-script name mapping

> `panchangamScript.js` currently covers **month names only**. Thithi names, all 27
> nakshatras, and the Rahu/Yamagandam/Gulika labels have no native-script mapping.
> Adding them is what turns the existing Tamil-labelled view into a genuine
> Malayalam-labelled view of the same computed data.

## Known limitations

1. **Single location.** Kalam times are sunrise-based and drift outside Kerala. `hhmm()`
   also hardcodes the IST offset (+330), so the script is not location-general in
   timezone terms either. Per-user-location precision ties into the Intent 2.4
   sunrise-based reminder work.
2. **Solar-noon sampling.** Thithi and nakshatra technically change at precise moments,
   not at noon. Sampling once per day is a standard simplification for a one-row-per-day
   table, but a thithi that begins in the evening is attributed to the following day.
   This matters for thithi-based observance scheduling.
3. **Single year.** No data past 31 December 2026, and no graceful fallback for a missing
   date. The year boundary needs handling before it arrives.
4. **Unvalidated against a physical panchangam.** The Intent 2.7 testing gate requires a
   manual cross-check that has not yet been completed.

## Annual maintenance

Pambu Panchangam publishes each February/March. Matching cadence:

1. Run `node scripts/generate-panchangam.cjs <next-year>`
2. Cross-check a sample against a trusted printed source
3. Load into `panchangam_days`
4. Confirm the varsham name and its rollover date

**Do this before the current year's data runs out**, not after - there is no fallback
for a missing date.

## Source-material position

Reproducing a specific publisher's calculated tables wholesale is an IP concern; the
underlying astronomy is not proprietary, and every modern panchang computes from the same
open drik ganita with minor ayanamsa/convention differences. The computed dataset above is
the app's source of record. A physical copy is used as a **read-only accuracy oracle** to
validate and tune the convention choices.

## Related

- Table schema: [01-DATABASE.md](01-DATABASE.md#panchangam_days)
- Thithi-cadence extension point: [02-RPCS.md](02-RPCS.md#is_scheduled--prev_scheduled)
