// @vitest-environment node
// Swiss Ephemeris oracle (dev/CI only, never shipped: AGPL). swisseph-v2 is a
// native module that builds in CI on Linux; where it cannot load (a Windows
// checkout installed with --ignore-scripts) this suite is skipped locally, but in
// CI a missing module FAILS the run, so the accuracy claim is always checked there.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { siderealPositions } from '../astro'

let swe = null
try { swe = createRequire(import.meta.url)('swisseph-v2') } catch { swe = null }

const arcmin = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 60
const BODIES = { Sun: 'SE_SUN', Moon: 'SE_MOON', Mars: 'SE_MARS', Mercury: 'SE_MERCURY', Jupiter: 'SE_JUPITER', Venus: 'SE_VENUS', Saturn: 'SE_SATURN', Rahu: 'SE_MEAN_NODE' }
// Arcminutes. The Moon is what names the birth star, so it has the tightest bound.
const TOL = { Moon: 1, Sun: 0.5, Mercury: 1, Venus: 1, Mars: 1, Jupiter: 1, Saturn: 1, Rahu: 1, Lagna: 2 }
const PLACES = [[13.083, 80.283], [10.107, 76.474], [8.524, 76.936], [28.652, 77.231], [22.572, 88.364], [19.073, 72.883], [12.972, 77.594], [26.912, 75.787]]

// Deterministic pseudo-random birth moments, 1930-2030.
function* cases(n) {
  let s = 20261115
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const from = Date.UTC(1930, 0, 1), to = Date.UTC(2030, 11, 31)
  for (let i = 0; i < n; i++) yield { ms: Math.floor(from + rnd() * (to - from)), place: PLACES[i % PLACES.length] }
}

const call = (fn, ...args) => new Promise((resolve) => fn(...args, resolve))

describe.skipIf(!swe && !process.env.CI)('sidereal positions match Swiss Ephemeris (Lahiri)', () => {
  it('within tolerance for 300 random births across India', async () => {
    expect(swe, 'swisseph-v2 must load in CI').not.toBeNull()
    swe.swe_set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0)
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL
    const worst = {}
    for (const { ms, place: [lat, lon] } of cases(300)) {
      const d = new Date(ms)
      const jd = swe.swe_julday(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
        d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600, swe.SE_GREG_CAL)
      const ours = siderealPositions(d, lat, lon).positions
      for (const [name, id] of Object.entries(BODIES)) {
        const res = await call(swe.swe_calc_ut, jd, swe[id], flags)
        const err = arcmin(ours[name], res.longitude)
        worst[name] = Math.max(worst[name] || 0, err)
      }
      const h = await call(swe.swe_houses_ex, jd, flags, lat, lon, 'W')
      worst.Lagna = Math.max(worst.Lagna || 0, arcmin(ours.Lagna, h.ascendant))
    }
    console.log('worst error (arcmin):', JSON.stringify(worst, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)))
    for (const [name, tol] of Object.entries(TOL)) expect(worst[name], name).toBeLessThan(tol)
  }, 120000)
})
