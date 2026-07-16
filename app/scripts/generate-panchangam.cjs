// One-off / annual generation script for the Today-page panchangam info box
// (Intent 2.7). Run manually (`node scripts/generate-panchangam.js <year>`),
// review the output, then load it via Supabase MCP - NOT auto-inserted, per
// the Intent's explicit "needs validation against a real Pambu Panchangam
// before going live" gate. Reference location: Kochi, Kerala (9.9312N,
// 76.2673E) - Rahu Kalam/Yamagandam/Gulika Kalam are sunrise-based and will
// drift for other locations (a documented v1 simplification).
//
// Method: drik ganita (true sidereal positions, Lahiri ayanamsa) via
// swisseph-v2, sampled at local solar noon per calendar day - a standard
// simplification for a one-row-per-day table (thithi/nakshatra/sankranti
// technically change at precise moments, not exactly at noon).
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

// Standard 8-part-of-daylight tables (widely published), 1-indexed part number.
const RAHU_PART = { 0: 8, 1: 2, 2: 7, 3: 5, 4: 6, 5: 4, 6: 3 } // 0=Sunday
const YAMA_PART = { 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 7, 6: 6 }
const GULIKA_PART = { 0: 7, 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 }

function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
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

function siderealLongitude(jd, body) {
  return new Promise((resolve) => {
    swe.swe_calc_ut(jd, body, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL, (res) => resolve(res.longitude))
  })
}

async function computeDay(y, m, d, samvatsaraIndex) {
  const { sunriseMin, sunsetMin } = sunTimes(y, m, d, LAT, LON)
  // Sample sidereal positions at local solar noon.
  const jdNoon = swe.swe_julday(y, m, d, 12 - LON / 15, swe.SE_GREG_CAL)
  const sunLon = await siderealLongitude(jdNoon, swe.SE_SUN)
  const moonLon = await siderealLongitude(jdNoon, swe.SE_MOON)

  const rashi = Math.floor(sunLon / 30)
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
    rashi, thithi, nakshatra,
    tamil_month: TAMIL_MONTHS[rashi], malayalam_month: MALAYALAM_MONTHS[rashi],
    varsham_name: SAMVATSARA[samvatsaraIndex],
    rahu_kalam_start: rahu.start, rahu_kalam_end: rahu.end,
    yamagandam_start: yama.start, yamagandam_end: yama.end,
    gulika_kalam_start: gulika.start, gulika_kalam_end: gulika.end,
  }
}

async function generateYear(year) {
  const rows = []
  let prevRashi = null
  let monthDay = 1
  // Samvatsara before this year's Mesha Sankranti = the previous cycle entry.
  let samvatsaraIndex = ((PARABHAVA_INDEX + (year - PARABHAVA_YEAR) - 1) % 60 + 60) % 60

  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))
  for (let dt = start; dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate()
    const day = await computeDay(y, m, d, samvatsaraIndex)

    if (prevRashi === null) {
      monthDay = 1 // first day of the generated range - exact prior sankranti unknown
    } else if (day.rashi !== prevRashi) {
      monthDay = 1
      if (prevRashi === 11 && day.rashi === 0) samvatsaraIndex = (samvatsaraIndex + 1) % 60
    } else {
      monthDay += 1
    }
    prevRashi = day.rashi

    rows.push({
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      thithi: day.thithi, nakshatra: day.nakshatra,
      rahu_kalam_start: day.rahu_kalam_start, rahu_kalam_end: day.rahu_kalam_end,
      yamagandam_start: day.yamagandam_start, yamagandam_end: day.yamagandam_end,
      gulika_kalam_start: day.gulika_kalam_start, gulika_kalam_end: day.gulika_kalam_end,
      tamil_month: day.tamil_month, tamil_day: monthDay,
      malayalam_month: day.malayalam_month, malayalam_day: monthDay,
      varsham_name: day.varsham_name,
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
