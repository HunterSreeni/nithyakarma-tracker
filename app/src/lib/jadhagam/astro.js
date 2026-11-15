// Sidereal (drik) positions for a birth chart: astronomy-engine (MIT) for the
// planets, our own Lahiri ayanamsa, mean lunar node, ascendant from sidereal time.
//
// AI-DEV NOTE: Swiss Ephemeris is AGPL/paid, so it must never ship in the app; it
// is only the CI oracle (src/lib/jadhagam/__tests__/oracle.test.js). Lahiri here
// follows Swiss Ephemeris' definition (SE_SIDM_LAHIRI: 23.245524743 deg on JD
// 2435553.5, carried by IAU 2006 general precession), applied to true-of-date
// longitudes with nutation added to the ayanamsa, the way Swiss computes sidereal
// positions. Rahu is the MEAN node: traditional Tamil jathagams use the mean node.
import { MakeTime, GeoVector, RotateVector, Rotation_EQJ_ECT, SphereFromVector, SiderealTime, Body } from 'astronomy-engine'

const D2R = Math.PI / 180
export const norm360 = (x) => ((x % 360) + 360) % 360

const LAHIRI_T0 = (2435553.5 - 2451545.0) / 36525
const LAHIRI_AYAN_T0 = 23.245524743
const precession = (T) => (5028.796195 * T + 1.1054348 * T * T) / 3600 // degrees, IAU 2006 p_A

// Nutation in longitude and obliquity, leading IAU 1980 terms (error < 1 arcsec).
function nutation(T) {
  const om = (125.04452 - 1934.136261 * T) * D2R
  const ls = (280.4665 + 36000.7698 * T) * D2R
  const lm = (218.3165 + 481267.8813 * T) * D2R
  return {
    dpsi: (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * ls) - 0.23 * Math.sin(2 * lm) + 0.21 * Math.sin(2 * om)) / 3600,
    deps: (9.2 * Math.cos(om) + 0.57 * Math.cos(2 * ls) + 0.1 * Math.cos(2 * lm) - 0.09 * Math.cos(2 * om)) / 3600,
  }
}

export function lahiriAyanamsa(T) {
  return LAHIRI_AYAN_T0 + precession(T) - precession(LAHIRI_T0)
}

export const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

// utc: a Date (the birth instant). lat/lon in degrees, east positive.
export function siderealPositions(utc, lat, lon) {
  const t = MakeTime(utc)
  const T = t.tt / 36525
  const { dpsi, deps } = nutation(T)
  const ayanMean = lahiriAyanamsa(T)
  const ayan = ayanMean + dpsi // true-of-date longitudes need the nutated ayanamsa
  const rot = Rotation_EQJ_ECT(t)

  const out = {}
  for (const name of PLANETS) {
    const v = GeoVector(Body[name], t, true)
    out[name] = norm360(SphereFromVector(RotateVector(rot, v)).lon - ayan)
  }
  // Mean node (Meeus 47.7) is on the mean equinox, so the mean ayanamsa applies.
  const node = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441
  out.Rahu = norm360(node - ayanMean)
  out.Ketu = norm360(out.Rahu + 180)

  // Ascendant from local apparent sidereal time and the true obliquity.
  const eps = (23.4392911 - 0.0130042 * T) * D2R + deps * D2R
  const ramc = norm360(SiderealTime(t) * 15 + lon) * D2R
  const asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat * D2R) * Math.sin(eps))) / D2R
  out.Lagna = norm360(asc - ayan)

  return { positions: out, ayanamsa: ayanMean }
}
