// "What is running now" for a chart: dasa / bhukti / antaram, Saturn and Jupiter
// transits counted from the birth rasi, the next chandrashtamam days, the next
// star birthday and the age. All of it is astronomy on this phone, nothing sent.
//
// AI-DEV NOTE: these are traditional labels, not predictions. The screen states
// the convention used for each; keep the wording factual ("Saturn is in the 8th
// from your rasi"), never a forecast.
import { siderealLon } from './astro'
import { NAK_SPAN } from './chart'
import { DASA_LORDS } from './dasa'
import { sunTimes, solarDate, localDate } from './panchangam'

const DAY = 86400000
const HOUR = 3600000
const signOf = (body, ms) => Math.floor(siderealLon(body, new Date(ms)) / 30)
const starOf = (ms) => Math.floor(siderealLon('Moon', new Date(ms)) / NAK_SPAN)
// House of a rasi counted from the birth rasi (1 = same rasi).
export const houseFrom = (birthRasi, rasi) => ((rasi - birthRasi + 12) % 12) + 1

// First moment after `from` (within `limit`) when test(ms) turns false, to the minute.
function nextChange(test, from, step, limit) {
  let prev = from
  for (let t = from + step; t <= from + limit; t += step) {
    if (!test(t)) {
      let lo = prev, hi = t
      while (hi - lo > 60000) { const mid = (lo + hi) / 2; if (test(mid)) lo = mid; else hi = mid }
      return hi
    }
    prev = t
  }
  return null
}

// Last moment before `from` (within `limit`) when test(ms) was false, i.e. when the state began.
function lastStart(test, from, step, limit) {
  let prev = from
  for (let t = from - step; t >= from - limit; t -= step) {
    if (!test(t)) {
      let lo = t, hi = prev
      while (hi - lo > 60000) { const mid = (lo + hi) / 2; if (test(mid)) hi = mid; else lo = mid }
      return hi
    }
    prev = t
  }
  return null
}

// The nine antarams (pratyantar dasas) inside a bhukti, starting with its lord.
export function antarams(bhukti) {
  const first = DASA_LORDS.findIndex((l) => l.key === bhukti.lord)
  const span = bhukti.end - bhukti.start
  const out = []
  let s = bhukti.start
  for (let j = 0; j < 9; j++) {
    const l = DASA_LORDS[(first + j) % 9]
    const e = s + (span * l.years) / 120
    out.push({ lord: l.key, start: s, end: e })
    s = e
  }
  return out
}

// AI-DEV NOTE: Tamil naming. Ezharai (seven-and-a-half year) sani is Saturn in the
// 12th, 1st and 2nd from the birth rasi; Ashtama sani the 8th; Arthashtama sani the 4th.
const SADE = { 12: 1, 1: 2, 2: 3 }
const SADE_PHASE = { 1: 'Viraya sani', 2: 'Janma sani', 3: 'Patha sani' }

export function saturnNow(birthRasi, nowMs) {
  const house = houseFrom(birthRasi, signOf('Saturn', nowMs))
  const signChange = nextChange((t) => houseFrom(birthRasi, signOf('Saturn', t)) === house, nowMs, 5 * DAY, 4 * 365 * DAY)
  if (SADE[house]) {
    const inSade = (t) => !!SADE[houseFrom(birthRasi, signOf('Saturn', t))]
    return {
      house, kind: 'ezharai', phase: SADE[house], phaseName: SADE_PHASE[SADE[house]], signChange,
      start: lastStart(inSade, nowMs, 5 * DAY, 9 * 365 * DAY),
      end: nextChange(inSade, nowMs, 5 * DAY, 9 * 365 * DAY),
    }
  }
  if (house === 8) return { house, kind: 'ashtama', signChange }
  if (house === 4) return { house, kind: 'arthashtama', signChange }
  return { house, kind: null, signChange }
}

export function jupiterNow(birthRasi, nowMs) {
  const house = houseFrom(birthRasi, signOf('Jupiter', nowMs))
  return { house, signChange: nextChange((t) => houseFrom(birthRasi, signOf('Jupiter', t)) === house, nowMs, 3 * DAY, 2 * 365 * DAY) }
}

// The next `count` spells of the Moon in the 8th rasi from the birth rasi.
export function chandrashtamam(birthRasi, nowMs, count = 3) {
  const target = (birthRasi + 7) % 12
  const inTarget = (t) => signOf('Moon', t) === target
  const out = []
  let t = nowMs
  if (inTarget(t)) {
    out.push({ start: lastStart(inTarget, t, 2 * HOUR, 3 * DAY), end: nextChange(inTarget, t, 2 * HOUR, 3 * DAY) })
    t = out[0].end + HOUR
  }
  while (out.length < count) {
    const start = nextChange((x) => !inTarget(x), t, 2 * HOUR, 30 * DAY)
    if (!start) break
    const end = nextChange(inTarget, start, 2 * HOUR, 3 * DAY)
    out.push({ start, end })
    t = end + HOUR
  }
  return out
}

// AI-DEV NOTE: star birthday convention, shown on screen: the day in the birth
// solar month whose star at sunrise is the birth star (Tamil). Kerala families
// use the star 6 nazhigai (2h24m) after sunrise. If the star falls on two days in
// the month, the first is shown. Check with the family's own practice.
export function nextStarBirthday({ birthStar, birthMonth, tradition, place }, nowMs) {
  const offset = tradition === 'kerala' ? 144 * 60000 : 0
  const today = localDate(new Date(nowMs), place.tz)
  for (let d = 0; d < 400; d++) {
    const iso = new Date(Date.parse(`${today}T12:00:00Z`) + d * DAY).toISOString().slice(0, 10)
    // Cheap pre-check at about 6 AM IST before computing the real sunrise.
    const approx = Date.parse(`${iso}T00:30:00Z`) + offset
    if (Math.abs(starOf(approx) - birthStar) > 1 && Math.abs(starOf(approx) - birthStar) < 26) continue
    const { sunrise } = sunTimes(iso, place)
    if (!sunrise || starOf(sunrise.getTime() + offset) !== birthStar) continue
    if (solarDate(iso, place, tradition).month !== birthMonth) continue
    return iso
  }
  return null
}

// Completed years and months between two "YYYY-MM-DD" dates.
export function ageOn(birthIso, todayIso) {
  const [by, bm, bd] = birthIso.split('-').map(Number)
  const [ty, tm, td] = todayIso.split('-').map(Number)
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  if (months < 0) months = 0
  return { years: Math.floor(months / 12), months: months % 12 }
}
