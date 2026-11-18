// Turns sidereal longitudes into what a Tamil jathagam shows: rasi, nakshatra and
// pada, navamsa (amsam), whole-sign houses from the lagna, and boundary warnings.
import { siderealPositions, isRetrograde } from './astro'

export const RASIS = [
  { en: 'Mesham', ta: 'மேஷம்', ml: 'മേടം' }, { en: 'Rishabam', ta: 'ரிஷபம்', ml: 'ഇടവം' }, { en: 'Mithunam', ta: 'மிதுனம்', ml: 'മിഥുനം' },
  { en: 'Kadagam', ta: 'கடகம்', ml: 'കർക്കടകം' }, { en: 'Simham', ta: 'சிம்மம்', ml: 'ചിങ്ങം' }, { en: 'Kanni', ta: 'கன்னி', ml: 'കന്നി' },
  { en: 'Thulam', ta: 'துலாம்', ml: 'തുലാം' }, { en: 'Viruchigam', ta: 'விருச்சிகம்', ml: 'വൃശ്ചികം' }, { en: 'Dhanusu', ta: 'தனுசு', ml: 'ധനു' },
  { en: 'Magaram', ta: 'மகரம்', ml: 'മകരം' }, { en: 'Kumbam', ta: 'கும்பம்', ml: 'കുംഭം' }, { en: 'Meenam', ta: 'மீனம்', ml: 'മീനം' },
]

export const NAKSHATRAS = [
  { en: 'Ashwini', ta: 'அசுவினி', ml: 'അശ്വതി' }, { en: 'Bharani', ta: 'பரணி', ml: 'ഭരണി' }, { en: 'Krittika', ta: 'கார்த்திகை', ml: 'കാർത്തിക' },
  { en: 'Rohini', ta: 'ரோகிணி', ml: 'രോഹിണി' }, { en: 'Mrigashira', ta: 'மிருகசீரிடம்', ml: 'മകയിരം' }, { en: 'Ardra', ta: 'திருவாதிரை', ml: 'തിരുവാതിര' },
  { en: 'Punarvasu', ta: 'புனர்பூசம்', ml: 'പുണർതം' }, { en: 'Pushya', ta: 'பூசம்', ml: 'പൂയം' }, { en: 'Ashlesha', ta: 'ஆயில்யம்', ml: 'ആയില്യം' },
  { en: 'Magha', ta: 'மகம்', ml: 'മകം' }, { en: 'Purva Phalguni', ta: 'பூரம்', ml: 'പൂരം' }, { en: 'Uttara Phalguni', ta: 'உத்திரம்', ml: 'ഉത്രം' },
  { en: 'Hasta', ta: 'அஸ்தம்', ml: 'അത്തം' }, { en: 'Chitra', ta: 'சித்திரை', ml: 'ചിത്തിര' }, { en: 'Swati', ta: 'சுவாதி', ml: 'ചോതി' },
  { en: 'Vishakha', ta: 'விசாகம்', ml: 'വിശാഖം' }, { en: 'Anuradha', ta: 'அனுஷம்', ml: 'അനിഴം' }, { en: 'Jyeshtha', ta: 'கேட்டை', ml: 'തൃക്കേട്ട' },
  { en: 'Mula', ta: 'மூலம்', ml: 'മൂലം' }, { en: 'Purva Ashadha', ta: 'பூராடம்', ml: 'പൂരാടം' }, { en: 'Uttara Ashadha', ta: 'உத்திராடம்', ml: 'ഉത്രാടം' },
  { en: 'Shravana', ta: 'திருவோணம்', ml: 'തിരുവോണം' }, { en: 'Dhanishta', ta: 'அவிட்டம்', ml: 'അവിട്ടം' }, { en: 'Shatabhisha', ta: 'சதயம்', ml: 'ചതയം' },
  { en: 'Purva Bhadrapada', ta: 'பூரட்டாதி', ml: 'പൂരുരുട്ടാതി' }, { en: 'Uttara Bhadrapada', ta: 'உத்திரட்டாதி', ml: 'ഉത്രട്ടാതി' }, { en: 'Revati', ta: 'ரேவதி', ml: 'രേവതി' },
]

// Short Tamil forms are the ones hand-written jathagams use inside the grid; mlShort
// are the Kerala grahanila letters (Ravi, Chandra, Kuja, Budha, Guru, Shukra, Manda,
// Sarpa, Shikhi). AI-DEV NOTE: every Malayalam name here was checked by Sreeni on
// 2026-11-18 against Kerala usage; change one only with a printed source.
export const GRAHAS = [
  { key: 'Lagna', abbr: 'La', en: 'Lagna', ta: 'லக்னம்', short: 'ல', ml: 'ലഗ്നം', mlShort: 'ല' },
  { key: 'Sun', abbr: 'Su', en: 'Sun', ta: 'சூரியன்', short: 'சூ', ml: 'സൂര്യൻ', mlShort: 'ര' },
  { key: 'Moon', abbr: 'Mo', en: 'Moon', ta: 'சந்திரன்', short: 'சந்', ml: 'ചന്ദ്രൻ', mlShort: 'ച' },
  { key: 'Mars', abbr: 'Ma', en: 'Mars', ta: 'செவ்வாய்', short: 'செவ்', ml: 'ചൊവ്വ', mlShort: 'കു' },
  { key: 'Mercury', abbr: 'Me', en: 'Mercury', ta: 'புதன்', short: 'பு', ml: 'ബുധൻ', mlShort: 'ബു' },
  { key: 'Jupiter', abbr: 'Ju', en: 'Jupiter', ta: 'குரு', short: 'குரு', ml: 'വ്യാഴം', mlShort: 'ഗു' },
  { key: 'Venus', abbr: 'Ve', en: 'Venus', ta: 'சுக்கிரன்', short: 'சுக்', ml: 'ശുക്രൻ', mlShort: 'ശു' },
  { key: 'Saturn', abbr: 'Sa', en: 'Saturn', ta: 'சனி', short: 'சனி', ml: 'ശനി', mlShort: 'മ' },
  { key: 'Rahu', abbr: 'Ra', en: 'Rahu', ta: 'ராகு', short: 'ரா', ml: 'രാഹു', mlShort: 'സ' },
  { key: 'Ketu', abbr: 'Ke', en: 'Ketu', ta: 'கேது', short: 'கே', ml: 'കേതു', mlShort: 'ശി' },
]

// Lord of each rasi, Mesham..Meenam (classical sign rulership).
export const RASI_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']

// AI-DEV NOTE: classical Parashari sign strength, shown labelled as such. Rahu and
// Ketu get none (traditions disagree on their signs); Mercury in Kanni is both
// exalted and own sign, and shows as exalted.
const EXALTED = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 }
const OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] }
const MOVES_BACKWARD = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

export function dignity(key, rasi) {
  if (!(key in EXALTED)) return null
  if (EXALTED[key] === rasi) return 'exalted'
  if ((EXALTED[key] + 6) % 12 === rasi) return 'debilitated'
  if (OWN[key].includes(rasi)) return 'own'
  return null
}

export const NAK_SPAN = 360 / 27
const PADA_SPAN = NAK_SPAN / 4

// AI-DEV NOTE: the warning margins are deliberately generous. A family jathagam
// may be cast from a vakya panchangam whose Moon differs from drik by several
// arcminutes (seen on a real chart: about 15'), so near an edge the two can name a
// different pada or lagna. We tell the user instead of pretending to be exact.
export const MOON_EDGE_DEG = 0.5
export const LAGNA_EDGE_DEG = 1

export const rasiIndex = (lon) => Math.floor(lon / 30)
export const navamsaIndex = (lon) => Math.floor(lon / (30 / 9)) % 12

export function nakshatraOf(lon) {
  const index = Math.floor(lon / NAK_SPAN)
  const into = lon - index * NAK_SPAN
  const pada = Math.floor(into / PADA_SPAN) + 1
  const intoPada = into - (pada - 1) * PADA_SPAN
  return { index, pada, into, toPadaEdge: Math.min(intoPada, PADA_SPAN - intoPada) }
}

export function buildChart({ utc, lat, lon }) {
  const { positions, ayanamsa } = siderealPositions(utc, lat, lon)
  const lagnaRasi = rasiIndex(positions.Lagna)
  const grahas = GRAHAS.map((g) => {
    const L = positions[g.key]
    const n = nakshatraOf(L)
    return {
      ...g, lon: L, rasi: rasiIndex(L), degInRasi: L % 30, navamsa: navamsaIndex(L),
      nakshatra: n.index, pada: n.pada, house: ((rasiIndex(L) - lagnaRasi + 12) % 12) + 1,
      vakra: MOVES_BACKWARD.includes(g.key) && isRetrograde(g.key, utc),
      dignity: dignity(g.key, rasiIndex(L)),
    }
  })
  const moon = nakshatraOf(positions.Moon)
  const lagnaDeg = positions.Lagna % 30
  const warnings = []
  if (moon.toPadaEdge < MOON_EDGE_DEG) warnings.push('moon-edge')
  if (Math.min(lagnaDeg, 30 - lagnaDeg) < LAGNA_EDGE_DEG) warnings.push('lagna-edge')
  return {
    ayanamsa, grahas, warnings,
    star: { nakshatra: moon.index, pada: moon.pada, rasi: rasiIndex(positions.Moon) },
    lagna: lagnaRasi,
    moonLon: positions.Moon,
  }
}

// Degrees as 16°10′ for display.
export function formatDeg(x) {
  let d = Math.floor(x)
  let m = Math.round((x - d) * 60)
  if (m === 60) { d += 1; m = 0 }
  return `${d}°${String(m).padStart(2, '0')}′`
}
