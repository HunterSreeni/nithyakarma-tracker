// Turns sidereal longitudes into what a Tamil jathagam shows: rasi, nakshatra and
// pada, navamsa (amsam), whole-sign houses from the lagna, and boundary warnings.
import { siderealPositions } from './astro'

export const RASIS = [
  { en: 'Mesham', ta: 'மேஷம்' }, { en: 'Rishabam', ta: 'ரிஷபம்' }, { en: 'Mithunam', ta: 'மிதுனம்' },
  { en: 'Kadagam', ta: 'கடகம்' }, { en: 'Simham', ta: 'சிம்மம்' }, { en: 'Kanni', ta: 'கன்னி' },
  { en: 'Thulam', ta: 'துலாம்' }, { en: 'Viruchigam', ta: 'விருச்சிகம்' }, { en: 'Dhanusu', ta: 'தனுசு' },
  { en: 'Magaram', ta: 'மகரம்' }, { en: 'Kumbam', ta: 'கும்பம்' }, { en: 'Meenam', ta: 'மீனம்' },
]

export const NAKSHATRAS = [
  { en: 'Ashwini', ta: 'அசுவினி' }, { en: 'Bharani', ta: 'பரணி' }, { en: 'Krittika', ta: 'கார்த்திகை' },
  { en: 'Rohini', ta: 'ரோகிணி' }, { en: 'Mrigashira', ta: 'மிருகசீரிடம்' }, { en: 'Ardra', ta: 'திருவாதிரை' },
  { en: 'Punarvasu', ta: 'புனர்பூசம்' }, { en: 'Pushya', ta: 'பூசம்' }, { en: 'Ashlesha', ta: 'ஆயில்யம்' },
  { en: 'Magha', ta: 'மகம்' }, { en: 'Purva Phalguni', ta: 'பூரம்' }, { en: 'Uttara Phalguni', ta: 'உத்திரம்' },
  { en: 'Hasta', ta: 'அஸ்தம்' }, { en: 'Chitra', ta: 'சித்திரை' }, { en: 'Swati', ta: 'சுவாதி' },
  { en: 'Vishakha', ta: 'விசாகம்' }, { en: 'Anuradha', ta: 'அனுஷம்' }, { en: 'Jyeshtha', ta: 'கேட்டை' },
  { en: 'Mula', ta: 'மூலம்' }, { en: 'Purva Ashadha', ta: 'பூராடம்' }, { en: 'Uttara Ashadha', ta: 'உத்திராடம்' },
  { en: 'Shravana', ta: 'திருவோணம்' }, { en: 'Dhanishta', ta: 'அவிட்டம்' }, { en: 'Shatabhisha', ta: 'சதயம்' },
  { en: 'Purva Bhadrapada', ta: 'பூரட்டாதி' }, { en: 'Uttara Bhadrapada', ta: 'உத்திரட்டாதி' }, { en: 'Revati', ta: 'ரேவதி' },
]

// Short Tamil forms are the ones hand-written jathagams use inside the grid.
export const GRAHAS = [
  { key: 'Lagna', en: 'Lagna', ta: 'லக்னம்', short: 'ல' },
  { key: 'Sun', en: 'Sun', ta: 'சூரியன்', short: 'சூ' },
  { key: 'Moon', en: 'Moon', ta: 'சந்திரன்', short: 'சந்' },
  { key: 'Mars', en: 'Mars', ta: 'செவ்வாய்', short: 'செவ்' },
  { key: 'Mercury', en: 'Mercury', ta: 'புதன்', short: 'பு' },
  { key: 'Jupiter', en: 'Jupiter', ta: 'குரு', short: 'குரு' },
  { key: 'Venus', en: 'Venus', ta: 'சுக்கிரன்', short: 'சுக்' },
  { key: 'Saturn', en: 'Saturn', ta: 'சனி', short: 'சனி' },
  { key: 'Rahu', en: 'Rahu', ta: 'ராகு', short: 'ரா' },
  { key: 'Ketu', en: 'Ketu', ta: 'கேது', short: 'கே' },
]

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
