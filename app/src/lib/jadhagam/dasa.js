// Vimshottari dasa: the mahadasa running at birth comes from the Moon's
// nakshatra, its unexpired part from how far the Moon still has to travel in it.
import { NAK_SPAN } from './chart'

export const DASA_LORDS = [
  { key: 'Ketu', years: 7 }, { key: 'Venus', years: 20 }, { key: 'Sun', years: 6 },
  { key: 'Moon', years: 10 }, { key: 'Mars', years: 7 }, { key: 'Rahu', years: 18 },
  { key: 'Jupiter', years: 16 }, { key: 'Saturn', years: 19 }, { key: 'Mercury', years: 17 },
]

// AI-DEV NOTE: longitude method with 365.25-day years. A family jathagam can show a
// different balance (a real one was 4 months shorter) because it took the Moon's
// nakshatra end time from a panchangam. The screen names this method so users know
// why dates may not match their paper; do not silently switch conventions.
export const YEAR_MS = 365.25 * 86400000

export function dasaBalance(moonLon) {
  const index = Math.floor(moonLon / NAK_SPAN)
  const lord = index % 9
  const remaining = 1 - (moonLon - index * NAK_SPAN) / NAK_SPAN
  return { lord, years: remaining * DASA_LORDS[lord].years }
}

// Mahadasas from birth for a full 120-year cycle, each with its nine bhuktis.
// The first mahadasa starts before birth; its bhuktis keep their true dates.
export function dasaTimeline(moonLon, birthMs) {
  const { lord, years } = dasaBalance(moonLon)
  let start = birthMs - (DASA_LORDS[lord].years - years) * YEAR_MS
  const periods = []
  for (let k = 0; k < 9; k++) {
    const md = (lord + k) % 9
    const mdYears = DASA_LORDS[md].years
    const end = start + mdYears * YEAR_MS
    const bhuktis = []
    let s = start
    for (let j = 0; j < 9; j++) {
      const b = (md + j) % 9
      const e = s + ((mdYears * DASA_LORDS[b].years) / 120) * YEAR_MS
      bhuktis.push({ lord: DASA_LORDS[b].key, start: s, end: e })
      s = e
    }
    periods.push({ lord: DASA_LORDS[md].key, start, end, bhuktis })
    start = end
  }
  return { balance: { lord: DASA_LORDS[lord].key, years }, periods }
}

export function currentPeriod(timeline, nowMs) {
  const md = timeline.periods.find((p) => nowMs >= p.start && nowMs < p.end)
  if (!md) return null
  return { md, bhukti: md.bhuktis.find((b) => nowMs >= b.start && nowMs < b.end) }
}

// Years as "5y 2m 1d" (30-day months), how jathagams print a dasa balance.
export function formatYears(years) {
  let y = Math.floor(years)
  const monthsF = (years - y) * 12
  let m = Math.floor(monthsF)
  let d = Math.round((monthsF - m) * 30)
  if (d === 30) { d = 0; m += 1 }
  if (m === 12) { m = 0; y += 1 }
  return `${y}y ${m}m ${d}d`
}
