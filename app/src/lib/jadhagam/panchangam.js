// The birth-day panchangam: weekday, tithi, yoga, karana, sunrise and sunset at
// the birth place, birth time in nazhigai, and the solar month and date in the
// Tamil and Kerala (Kollam) traditions, plus the samvatsara / Kollam year.
//
// AI-DEV NOTE: the solar month day-1 rules mirror scripts/generate-panchangam.cjs
// (protected, AGENTS.md "Panchangam / observance calendar"): Tamil Nadu starts a
// month on the sankranti day only if the ingress is before SUNSET, Kerala only if
// it is before APARAHNA (sunrise + 3/5 of daylight). Do not unify them. Tests
// check every day of 2026 and 2027 against that generator's swisseph output.
//
// AI-DEV NOTE: a Hindu day runs sunrise to sunrise. A birth after midnight but
// before sunrise belongs to the previous day's weekday, Tamil date and nazhigai
// count, which is how a paper jathagam records it.
import { Observer, SearchRiseSet, Body } from 'astronomy-engine'
import { siderealLon } from './astro'
import { zonedToUtc } from './time'

const DAY = 86400000

export const WEEKDAYS = [
  { en: 'Sunday', ta: 'ஞாயிறு', ml: 'ഞായർ' }, { en: 'Monday', ta: 'திங்கள்', ml: 'തിങ്കൾ' }, { en: 'Tuesday', ta: 'செவ்வாய்', ml: 'ചൊവ്വ' },
  { en: 'Wednesday', ta: 'புதன்', ml: 'ബുധൻ' }, { en: 'Thursday', ta: 'வியாழன்', ml: 'വ്യാഴം' }, { en: 'Friday', ta: 'வெள்ளி', ml: 'വെള്ളി' },
  { en: 'Saturday', ta: 'சனி', ml: 'ശനി' },
]
const TITHI_NAMES = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Sashti', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi']
export const YOGAS = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti',
  'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti']
const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti']
export const TAMIL_MONTHS = [
  { en: 'Chithirai', ta: 'சித்திரை' }, { en: 'Vaikasi', ta: 'வைகாசி' }, { en: 'Aani', ta: 'ஆனி' },
  { en: 'Aadi', ta: 'ஆடி' }, { en: 'Aavani', ta: 'ஆவணி' }, { en: 'Purattasi', ta: 'புரட்டாசி' },
  { en: 'Aippasi', ta: 'ஐப்பசி' }, { en: 'Karthikai', ta: 'கார்த்திகை' }, { en: 'Margazhi', ta: 'மார்கழி' },
  { en: 'Thai', ta: 'தை' }, { en: 'Maasi', ta: 'மாசி' }, { en: 'Panguni', ta: 'பங்குனி' },
]
// Malayalam month names in English; in Malayalam script they are the rasi names (RASIS[i].ml).
export const MALAYALAM_MONTHS = ['Medam', 'Edavam', 'Mithunam', 'Karkidakam', 'Chingam', 'Kanni', 'Thulam',
  'Vrischikam', 'Dhanu', 'Makaram', 'Kumbham', 'Meenam']
// Same 60-year list and anchor as the panchangam generator: index 39 (Parabhava)
// begins at Mesha Sankranti, April 2026.
export const SAMVATSARA = [
  'Prabhava', 'Vibhava', 'Shukla', 'Pramoduta', 'Prajapati', 'Angirasa', 'Shrimukha', 'Bhava', 'Yuva', 'Dhatu',
  'Ishvara', 'Bahudhanya', 'Pramathi', 'Vikrama', 'Vrisha', 'Chitrabhanu', 'Subhanu', 'Tarana', 'Parthiva', 'Vyaya',
  'Sarvajit', 'Sarvadhari', 'Virodhi', 'Vikriti', 'Khara', 'Nandana', 'Vijaya', 'Jaya', 'Manmatha', 'Durmukhi',
  'Hevilambi', 'Vilambi', 'Vikari', 'Sharvari', 'Plava', 'Shubhakrit', 'Shobhakrit', 'Krodhi', 'Vishvavasu', 'Parabhava',
  'Plavanga', 'Kilaka', 'Saumya', 'Sadharana', 'Virodhikrit', 'Paridhavi', 'Pramadi', 'Ananda', 'Rakshasa', 'Nala',
  'Pingala', 'Kalayukti', 'Siddharthi', 'Raudra', 'Durmati', 'Dundubhi', 'Rudhirodgari', 'Raktakshi', 'Krodhana', 'Akshaya',
]
const PARABHAVA_INDEX = 39
const PARABHAVA_YEAR = 2026
// Kollam era: ME 1202 began on Chingam 1 = 17 Aug 2026.
const KOLLAM_OFFSET = 824
const MESHAM = 0
const CHINGAM = 4

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY)

// Local calendar date ("YYYY-MM-DD") of an instant in a time zone.
export function localDate(utc, timeZone) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc)
  const get = (t) => p.find((x) => x.type === t).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Sunrise and sunset (Date) at the place on a local date: upper limb, with
// refraction, the way drik panchangams publish them.
export function sunTimes(iso, place) {
  const [year, month, day] = iso.split('-').map(Number)
  const midnight = zonedToUtc({ year, month, day, hour: 0, minute: 0 }, place.tz)
  const obs = new Observer(place.lat, place.lon, 0)
  const rise = SearchRiseSet(Body.Sun, obs, +1, midnight, 1)
  const set = SearchRiseSet(Body.Sun, obs, -1, midnight, 1)
  return { sunrise: rise?.date ?? null, sunset: set?.date ?? null }
}

// The moment the sidereal Sun reaches targetDeg, searched within +-windowDays of near.
export function sankranti(targetDeg, near, windowDays = 20) {
  const f = (ms) => ((siderealLon('Sun', new Date(ms)) - targetDeg + 540) % 360) - 180
  let lo = near.getTime() - windowDays * DAY
  let hi = near.getTime() + windowDays * DAY
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < 0) lo = mid
    else hi = mid
  }
  return new Date(hi)
}

// The moment that decides a day's solar month: a month starts on the sankranti
// day only if the ingress is before this moment (sunset in Tamil Nadu, aparahna
// = sunrise + 3/5 of daylight in Kerala).
function cutoff(iso, place, rule) {
  const { sunrise, sunset } = sunTimes(iso, place)
  return new Date(rule === 'kerala' ? sunrise.getTime() + 0.6 * (sunset - sunrise) : sunset.getTime())
}

// Day 1 of the month opened by a sankranti, under a tradition's rule.
function monthStart(ingress, place, rule) {
  const day = localDate(ingress, place.tz)
  return ingress < cutoff(day, place, rule) ? day : addDays(day, 1)
}

// Solar month (0 = Chithirai/Medam) and day for a Hindu date at a place.
// The month of a day is the Sun's rasi at that day's cutoff moment.
export function solarDate(hinduDate, place, tradition) {
  const at = cutoff(hinduDate, place, tradition)
  const lon = siderealLon('Sun', at)
  const rasi = Math.floor(lon / 30)
  // The ingress into this rasi was at most ~32 days ago; search near its estimate.
  const near = new Date(at.getTime() - ((lon - rasi * 30) / 0.9856) * DAY)
  const start = monthStart(sankranti(rasi * 30, near, 3), place, tradition)
  return { month: rasi, day: daysBetween(start, hinduDate) + 1 }
}

// Start date of a given solar month in a Gregorian year (Chithirai ~14 Apr, Chingam ~17 Aug).
function yearMonthStart(year, rasi, place, tradition) {
  const approx = new Date(Date.UTC(year, 3, 14) + rasi * 30.44 * DAY)
  return monthStart(sankranti(rasi * 30, approx, 12), place, tradition)
}

// Tamil samvatsara (rolls at Chithirai 1, Tamil rule) and Kollam year (rolls at Chingam 1, Kerala rule).
export function yearNames(hinduDate, place) {
  const y = Number(hinduDate.slice(0, 4))
  const base = (((PARABHAVA_INDEX + (y - PARABHAVA_YEAR)) % 60) + 60) % 60
  const samvatsara = hinduDate >= yearMonthStart(y, MESHAM, place, 'tamil') ? base : (base + 59) % 60
  const kollam = (hinduDate >= yearMonthStart(y, CHINGAM, place, 'kerala') ? y : y - 1) - KOLLAM_OFFSET
  return { samvatsara: SAMVATSARA[samvatsara], kollamYear: kollam }
}

// Tithi / yoga / karana from sidereal Sun and Moon longitudes.
export function tithiYogaKarana(sun, moon) {
  const diff = ((moon - sun) % 360 + 360) % 360
  const t = Math.floor(diff / 12)
  const paksha = t < 15 ? 'Shukla' : 'Krishna'
  const inPaksha = t % 15
  const tithi = inPaksha === 14 ? (paksha === 'Shukla' ? 'Purnima' : 'Amavasya') : `${paksha} ${TITHI_NAMES[inPaksha]}`
  const yoga = YOGAS[Math.floor((((sun + moon) % 360) + 360) % 360 / (360 / 27))]
  const k = Math.floor(diff / 6)
  const karana = k === 0 ? 'Kimstughna' : k >= 57 ? ['Shakuni', 'Chatushpada', 'Naga'][k - 57] : MOVABLE_KARANAS[(k - 1) % 7]
  return { tithiIndex: t, paksha, tithi, yoga, karana }
}

// Everything the Panchangam tab shows for one birth.
export function birthPanchangam(utc, place, tradition = 'tamil') {
  let civil = localDate(utc, place.tz)
  let { sunrise, sunset } = sunTimes(civil, place)
  let hinduDate = civil
  if (sunrise && utc < sunrise) {
    hinduDate = addDays(civil, -1)
    ;({ sunrise, sunset } = sunTimes(hinduDate, place))
  }
  const sun = siderealLon('Sun', utc)
  const moon = siderealLon('Moon', utc)
  const minutes = sunrise ? (utc - sunrise) / 60000 : null
  const nazhigai = minutes === null ? null : { nazhigai: Math.floor(minutes / 24), vinadi: Math.floor((minutes % 24) * 2.5) }
  const weekday = new Date(`${hinduDate}T12:00:00Z`).getUTCDay()
  return {
    hinduDate, weekday,
    sunrise, sunset,
    nazhigai,
    ...tithiYogaKarana(sun, moon),
    solar: solarDate(hinduDate, place, tradition),
    ...yearNames(hinduDate, place),
  }
}
