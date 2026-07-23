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
| Solar month | The exact sankranti (sidereal ingress) moment, bisected to under a minute - **not** noon-sampled. See below. |
| Month day | Days elapsed since that month's day 1, where day 1 is chosen by a per-tradition rule |
| Sunrise / sunset | NOAA/Meeus low-precision solar position - self-contained, no ephemeris dependency, independently verifiable |
| Rahu / Yamagandam / Gulika | Daylight split into 8 equal parts; a published weekday→part table selects the window |

### Tamil and Malayalam share the ingress, not the day numbering

Both are **solar** calendars driven by the same sidereal ingress, so they always agree on
*which* rashi is current. They do **not** always agree on which Gregorian day is day 1 of
it, because each tradition uses a different cutoff on the sankranti day:

| Tradition | Rule | Cutoff at Kochi |
|---|---|---|
| Kerala (Malayalam) | **Aparahna** - sunrise + 3/5 of daylight | ~13:36 IST |
| Tamil Nadu | Sunset | ~18:30 IST |
| *(what this script did before)* | *Local solar noon* | *12:25 IST* |

If the sankranti falls before the cutoff, that day is day 1; otherwise day 1 is the next
day. Noon-sampling agreed with the aparahna rule for eleven of twelve months in 2026 - by
coincidence, not by correctness. The twelfth, **Mithunam, ingresses at 12:53 IST on 15
June 2026**, inside the ~70-minute gap between solar noon and aparahna, and was assigned
to 16 June. Prokerala and DrikPanchang both publish 15 June.

`MONTH_START_RULE` in the generator holds one rule per tradition, so this is the extension
point for further regional solar calendars.

> **Tamil is on the `sunset` rule, switched from `noon` 2026-07-20.** Verified against two
> independent sources for the Pongal 2026 test case: DrikPanchang gives the Makar Sankranti
> moment as 14 January 2026, 3:13 PM IST (Chennai), with Punya Kala running to 6:01 PM -
> well before sunset, so Thai 1 falls the same day, 14 January, not 15 January as the old
> noon-sampling produced. dailycalendartamil.com independently corroborates 14 January as
> the main Thai Pongal day. `panchangam-2026.json` was regenerated and reloaded; the shift
> ripples forward as a one-day offset in the Tamil day count from 14 January through
> 16 July, until the already-independently-verified Aadi 1 (17 July) boundary re-anchors it -
> expected, not a bug, confirmed against every other pinned test date in
> `panchangam-output.test.js`.

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

### Kollavarsham (Malayalam Era)

Kerala numbers its years rather than naming them from the 60-cycle, and rolls over at
**Chingam 1** - a separate, later boundary from the samvatsara rollover at Mesha
Sankranti. Both are stored, because a Malayalam-labelled view showing `Parabhava` and
nothing else is using a Tamil/Sanskrit convention on a Kerala calendar.

For 2026: ME **1201** until 16 August, ME **1202** from Chingam 1 on 17 August.

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

Current contents: **365 rows covering 2026 only**, carrying `kollavarsham_year` as of
19 July 2026.

## Client

- `hooks/usePanchangam.js` (21 lines) - fetches today's row
- `components/PanchangamBox.jsx` (26 lines) - renders it, below the Namaskaram greeting
- `utils/panchangamScript.js` - native-script name mapping

`panchangamScript.js` exports Tamil month names, and for Malayalam: months, all 27
nakshatras, the 30 thithi names (via `malayalamThithi()`, which recomposes the stored
`<Paksha> <Tithi>` string), and the three kalam labels.

> Kerala does **not** transliterate the Sanskrit nakshatra names - it uses its own
> traditional set (Ardra is Thiruvathira, Shravana is Thiruvonam, Ashwini is Ashwathi).
> The map is keyed off the Sanskrit name the generator stores, so no schema change was
> needed. **`PanchangamBox.jsx` does not consume the new maps yet** - it still renders
> transliterated thithi/nakshatra. Wiring it up is a display-only change.

## Known limitations

1. **Single location.** Kalam times are sunrise-based and drift outside Kerala. `hhmm()`
   also hardcodes the IST offset (+330), so the script is not location-general in
   timezone terms either. Per-user-location precision ties into the Intent 2.4
   sunrise-based reminder work.
2. **Solar-noon sampling - thithi and nakshatra only.** Both technically change at precise
   moments, not at noon. Sampling once per day is a standard simplification for a
   one-row-per-day table, but a thithi that begins in the evening is attributed to the
   following day. This matters for thithi-based observance scheduling. *(Solar month and
   month-day no longer noon-sample - they use the exact sankranti moment.)*
3. **Two years.** `panchangam_days` covers 2026 and 2027 (2027 loaded 23 July 2026, 365
   rows, spot-checked below). No data past 31 December 2027, and no graceful fallback for
   a missing date. The year boundary needs handling before it arrives.
4. **Partially validated.** On 19 July 2026 the Malayalam side was cross-checked against
   Prokerala and DrikPanchang: **10 of 12** month starts confirmed (Makaram, Kumbham,
   Meenam, Medam, Edavam, Mithunam, Karkidakam, Chingam, Thulam, Vrischikam). Kanni
   (17 Sep) and Dhanu (16 Dec) were not sourced but follow the same verified rule. The
   computed Makaram sankranti (14 Jan 15:07 IST) matches the published moment to the
   minute, which is the strongest single check on the ephemeris itself.

   **Tamil day-1 rule resolved 2026-07-20** (see the `MONTH_START_RULE` note above) - Pongal
   2026 confirmed as 14 January against DrikPanchang and dailycalendartamil.com.

   **2027 spot-checked 23 July 2026 against two independent oracles**, per the Source-material
   position below (the physical book is used to validate, never to transcribe):
   - **Tamil**, against the physical Pambu Panchangam (Parabhava year, Apr 2026-Apr 2027):
     Thai 1 = 15 Jan 2027 (book page 18, row 1), Thai Amavasya = 6 Feb 2027/Thai day 23 (book
     page 18, row 23: "தை அமாவாசை"), Panguni 1 = 15 March 2027 (book page 20, row 1) - all
     three match exactly.
   - **Malayalam**, against DrikPanchang/Prokerala (the book is Tamil-only): Makaram 1 = 15
     Jan 2027 matches DrikPanchang's exact sankranti moment (15 Jan, 2:45 AM IST - already
     past midnight, so both the sunset and aparahna cutoffs land on the 15th regardless of
     tradition); Chingam 1 = 18 Aug 2027 matches published Malayalam New Year sources.
   - Pinned as regression tests in `scripts/__tests__/panchangam-2027-output.test.js`.

## Annual maintenance

Pambu Panchangam publishes each February/March. Matching cadence:

1. Run `node scripts/generate-panchangam.cjs <next-year>`
2. **Tamil**: cross-check a sample against a trusted printed source (the physical Pambu
   Panchangam, used only to validate specific computed dates - never transcribed, per the
   Source-material position below)
3. **Malayalam**: cross-check the same sample dates against DrikPanchang and Prokerala - the
   physical Pambu Panchangam is Tamil-only and must not be used as the Malayalam oracle
4. Load into `panchangam_days`
5. Confirm the varsham name and its rollover date
6. Add pinned regression-test assertions for the dates checked in steps 2-3, mirroring
   `panchangam-2027-output.test.js`

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
