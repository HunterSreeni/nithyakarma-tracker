// One-off / annual generation script for the Today-page panchangam info box
// (Intent 2.7). Run manually (`node scripts/generate-panchangam.cjs <year>`),
// review the output, then load it via Supabase MCP - NOT auto-inserted, per
// the Intent's explicit "needs validation against a real Pambu Panchangam
// before going live" gate. Reference location: Kochi, Kerala (9.9312N,
// 76.2673E) - Rahu Kalam/Yamagandam/Gulika Kalam are sunrise-based and will
// drift for other locations (a documented v1 simplification).
//
// Method: drik ganita (true sidereal positions, Lahiri ayanamsa) via
// swisseph-v2. Thithi and nakshatra are sampled at local solar noon - a
// standard simplification for a one-row-per-day table.
//
// Solar month and month-day are NOT noon-sampled. They come from the exact
// sankranti (sidereal ingress) moment, because Tamil Nadu and Kerala assign
// the ingress day to a month by different rules, and noon-sampling silently
// picks neither. See MONTH_START_RULE below.
const swe = require('swisseph-v2')
const fs = require('fs')
const path = require('path')

const LAT = 9.9312
const LON = 76.2673

swe.swe_set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0)

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
]
const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
]
const TAMIL_MONTHS = ['Chithirai', 'Vaikasi', 'Aani', 'Aadi', 'Aavani', 'Purattasi', 'Aippasi', 'Karthikai', 'Margazhi', 'Thai', 'Maasi', 'Panguni']
const MALAYALAM_MONTHS = ['Medam', 'Edavam', 'Mithunam', 'Karkidakam', 'Chingam', 'Kanni', 'Thulam', 'Vrischikam', 'Dhanu', 'Makaram', 'Kumbham', 'Meenam']

// Which moment of the sankranti day decides whether that day is day 1 of the
// new month, or whether day 1 is the following day.
//
//   aparahna - Kerala. Sunrise + 3/5 of daylight. This is the documented
//              Malayalam rule and is verified against Prokerala and
//              DrikPanchang for all twelve 2026 months.
//   sunset   - Tamil Nadu's actual rule. Verified 2026-07-20 against two
//              independent sources for the Pongal 2026 test case: DrikPanchang
//              gives the Makar Sankranti moment as 14 Jan 2026, 3:13 PM IST
//              (Chennai), with Punya Kala running to 6:01 PM - well before
//              sunset, so Thai 1 falls the same day, 14 Jan, not 15 Jan as the
//              old noon-sampling produced. dailycalendartamil.com
//              independently corroborates 14 Jan as the main Thai Pongal day.
const MONTH_START_RULE = {
  tamil: 'sunset',
  malayalam: 'aparahna',
}

// 60-year Samvatsara cycle. Index 39 (Parabhava) = the year starting Mesha
// Sankranti (South Indian solar new year) in April 2026 - confirmed against
// published references for 2026-27.
const SAMVATSARA = [
  'Prabhava', 'Vibhava', 'Shukla', 'Pramoduta', 'Prajapati', 'Angirasa', 'Shrimukha', 'Bhava', 'Yuva', 'Dhatu',
  'Ishvara', 'Bahudhanya', 'Pramathi', 'Vikrama', 'Vrisha', 'Chitrabhanu', 'Subhanu', 'Tarana', 'Parthiva', 'Vyaya',
  'Sarvajit', 'Sarvadhari', 'Virodhi', 'Vikriti', 'Khara', 'Nandana', 'Vijaya', 'Jaya', 'Manmatha', 'Durmukhi',
  'Hevilambi', 'Vilambi', 'Vikari', 'Sharvari', 'Plava', 'Shubhakrit', 'Shobhakrit', 'Krodhi', 'Vishvavasu', 'Parabhava',
  'Plavanga', 'Kilaka', 'Saumya', 'Sadharana', 'Virodhikrit', 'Paridhavi', 'Pramadi', 'Ananda', 'Rakshasa', 'Nala',
  'Pingala', 'Kalayukti', 'Siddharthi', 'Raudra', 'Durmati', 'Dundubhi', 'Rudhirodgari', 'Raktakshi', 'Krodhana', 'Akshaya',
]
const PARABHAVA_INDEX = 39
const PARABHAVA_YEAR = 2026 // the Mesha-Sankranti year that begins the Parabhava samvatsara

// Kollavarsham (Malayalam Era). Kerala numbers its years rather than naming
// them from the 60-cycle, and rolls over at Chingam 1 - a different date from
// the samvatsara rollover at Mesha Sankranti. ME 1202 begins Chingam 1 = 17
// August 2026, so the offset is (Gregorian - 824) on or after Chingam 1.
const KOLLAVARSHAM_OFFSET = 824
const CHINGAM_RASHI = 4

// Standard 8-part-of-daylight tables (widely published), 1-indexed part number.
const RAHU_PART = { 0: 8, 1: 2, 2: 7, 3: 5, 4: 6, 5: 4, 6: 3 } // 0=Sunday
const YAMA_PART = { 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 7, 6: 6 }
const GULIKA_PART = { 0: 7, 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 }

function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// NOAA/Meeus low-precision solar position - self-contained, no ephemeris
// dependency, easy to independently verify. Returns sunrise/sunset as minutes
// from UTC midnight.
function sunTimes(y, m, d, lat, lon) {
  const rad = Math.PI / 180, deg = 180 / Math.PI
  const gamma = (2 * Math.PI / 365) * (dayOfYear(y, m, d) - 1 + 12 / 24)
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const latr = lat * rad
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(latr) * Math.cos(decl)) - Math.tan(latr) * Math.tan(decl)
  const ha0 = Math.acos(cosHa) * deg
  const solarNoon = 720 - 4 * lon - eqtime
  return { sunriseMin: solarNoon - 4 * ha0, sunsetMin: solarNoon + 4 * ha0 }
}

function hhmm(utcMinutes) {
  const m = ((Math.round(utcMinutes) % 1440) + 1440) % 1440
  const istMin = m + 330 // UTC+5:30
  const h = Math.floor(istMin / 60) % 24
  const mi = istMin % 60
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

function kalamWindow(sunriseMin, sunsetMin, part) {
  const step = (sunsetMin - sunriseMin) / 8
  const start = sunriseMin + (part - 1) * step
  return { start: hhmm(start), end: hhmm(start + step) }
}

// The three candidate day-1 cutoffs, as UT julian days, for one local date.
function dayMarkers(y, m, d) {
  const { sunriseMin, sunsetMin } = sunTimes(y, m, d, LAT, LON)
  const jdMidnight = swe.swe_julday(y, m, d, 0, swe.SE_GREG_CAL)
  const sunrise = jdMidnight + sunriseMin / 1440
  const sunset = jdMidnight + sunsetMin / 1440
  return {
    sunset,
    aparahna: sunrise + 0.6 * (sunset - sunrise),
    noon: swe.swe_julday(y, m, d, 12 - LON / 15, swe.SE_GREG_CAL),
  }
}

function siderealLongitude(jd, body) {
  return new Promise((resolve) => {
    swe.swe_calc_ut(jd, body, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL, (res) => resolve(res.longitude))
  })
}

// Local (IST) calendar date containing a UT julian day.
function istDate(jd) {
  const r = swe.swe_revjul(jd + 5.5 / 24, swe.SE_GREG_CAL)
  return { y: r.year, m: r.month, d: r.day }
}

// Exact sidereal ingress moments in [fromJd, toJd]. Coarse 6-hour scan (the
// Sun covers ~0.25 deg, so a 30-deg sector can never be skipped) then bisect
// to well under a minute.
async function findSankrantis(fromJd, toJd) {
  const out = []
  const STEP = 0.25
  let prevRashi = Math.floor(await siderealLongitude(fromJd, swe.SE_SUN) / 30)
  let prevJd = fromJd
  for (let jd = fromJd + STEP; jd <= toJd; jd += STEP) {
    const rashi = Math.floor(await siderealLongitude(jd, swe.SE_SUN) / 30)
    if (rashi !== prevRashi) {
      let lo = prevJd, hi = jd
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (Math.floor(await siderealLongitude(mid, swe.SE_SUN) / 30) === prevRashi) lo = mid
        else hi = mid
      }
      out.push({ jd: hi, rashi })
    }
    prevRashi = rashi
    prevJd = jd
  }
  return out
}

// The Gregorian date that is day 1 of the month this sankranti opens, under
// the given tradition's rule.
function monthStartDate(jdSankranti, rule) {
  const loc = istDate(jdSankranti)
  const cutoff = dayMarkers(loc.y, loc.m, loc.d)[rule]
  if (jdSankranti < cutoff) return ymd(loc.y, loc.m, loc.d)
  const next = new Date(Date.UTC(loc.y, loc.m - 1, loc.d + 1))
  return ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

// [{ start: 'YYYY-MM-DD', rashi }] ascending, for one tradition.
function monthStarts(sankrantis, rule) {
  return sankrantis.map(s => ({ start: monthStartDate(s.jd, rule), rashi: s.rashi }))
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000)
}

// Most recent month start on or before `date`.
function monthOn(starts, date) {
  let found = null
  for (const s of starts) {
    if (s.start <= date) found = s
    else break
  }
  return found
}

async function computeDay(y, m, d) {
  const { sunriseMin, sunsetMin } = sunTimes(y, m, d, LAT, LON)
  // Sample sidereal positions at local solar noon.
  const jdNoon = swe.swe_julday(y, m, d, 12 - LON / 15, swe.SE_GREG_CAL)
  const sunLon = await siderealLongitude(jdNoon, swe.SE_SUN)
  const moonLon = await siderealLongitude(jdNoon, swe.SE_MOON)

  const nakshatra = NAKSHATRAS[Math.floor(moonLon / (360 / 27)) % 27]

  const tithiDiff = ((moonLon - sunLon) % 360 + 360) % 360
  const tithiIndex = Math.floor(tithiDiff / 12)
  const paksha = tithiIndex < 15 ? 'Shukla' : 'Krishna'
  const dayInPaksha = tithiIndex % 15
  const thithi = dayInPaksha === 14
    ? (paksha === 'Shukla' ? 'Purnima' : 'Amavasya')
    : `${paksha} ${TITHI_NAMES[dayInPaksha]}`

  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const rahu = kalamWindow(sunriseMin, sunsetMin, RAHU_PART[weekday])
  const yama = kalamWindow(sunriseMin, sunsetMin, YAMA_PART[weekday])
  const gulika = kalamWindow(sunriseMin, sunsetMin, GULIKA_PART[weekday])

  return {
    thithi, nakshatra,
    rahu_kalam_start: rahu.start, rahu_kalam_end: rahu.end,
    yamagandam_start: yama.start, yamagandam_end: yama.end,
    gulika_kalam_start: gulika.start, gulika_kalam_end: gulika.end,
  }
}

async function generateYear(year) {
  // Start the scan in the previous November so the month running through 1
  // January has a real start date - the day number on 1 January continues the
  // previous December's month rather than restarting at 1.
  const scanFrom = swe.swe_julday(year - 1, 11, 1, 0, swe.SE_GREG_CAL)
  const scanTo = swe.swe_julday(year, 12, 31, 24, swe.SE_GREG_CAL)
  const sankrantis = await findSankrantis(scanFrom, scanTo)

  const tamilStarts = monthStarts(sankrantis, MONTH_START_RULE.tamil)
  const malayalamStarts = monthStarts(sankrantis, MONTH_START_RULE.malayalam)

  // Samvatsara rolls at Mesha Sankranti, on the Tamil reckoning (the audience
  // references Pambu Panchangam). Parabhava must begin ON Chithirai 1, not the
  // day after it.
  const meshaStart = tamilStarts.find(s => s.rashi === 0 && s.start.startsWith(String(year)))
  const baseIndex = ((PARABHAVA_INDEX + (year - PARABHAVA_YEAR)) % 60 + 60) % 60
  // Kollavarsham rolls at Chingam 1 - a separate, later boundary.
  const chingamStart = malayalamStarts.find(s => s.rashi === CHINGAM_RASHI && s.start.startsWith(String(year)))

  const rows = []
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))
  for (let dt = start; dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate()
    const date = ymd(y, m, d)
    const day = await computeDay(y, m, d)

    const tamil = monthOn(tamilStarts, date)
    const malayalam = monthOn(malayalamStarts, date)
    const samvatsaraIndex = date >= meshaStart.start ? baseIndex : (baseIndex + 59) % 60

    rows.push({
      date,
      thithi: day.thithi, nakshatra: day.nakshatra,
      rahu_kalam_start: day.rahu_kalam_start, rahu_kalam_end: day.rahu_kalam_end,
      yamagandam_start: day.yamagandam_start, yamagandam_end: day.yamagandam_end,
      gulika_kalam_start: day.gulika_kalam_start, gulika_kalam_end: day.gulika_kalam_end,
      tamil_month: TAMIL_MONTHS[tamil.rashi], tamil_day: daysBetween(tamil.start, date) + 1,
      malayalam_month: MALAYALAM_MONTHS[malayalam.rashi], malayalam_day: daysBetween(malayalam.start, date) + 1,
      varsham_name: SAMVATSARA[samvatsaraIndex],
      kollavarsham_year: (date >= chingamStart.start ? year : year - 1) - KOLLAVARSHAM_OFFSET,
    })
  }
  return rows
}

const year = Number(process.argv[2]) || new Date().getFullYear()
generateYear(year).then((rows) => {
  const outPath = path.join(__dirname, `panchangam-${year}.json`)
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2))
  console.log(`Wrote ${rows.length} days to ${outPath}`)
  console.log('NOT auto-inserted - review, then load via Supabase MCP per the Intent 2.7 validation gate.')
})
