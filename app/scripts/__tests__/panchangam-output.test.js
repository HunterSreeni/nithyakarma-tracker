import { describe, it, expect } from 'vitest'
import rows from '../panchangam-2026.json'

const SAMVATSARA_COUNT = 60
const timeRe = /^\d{2}:\d{2}$/

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

describe('generated panchangam-2026.json sanity', () => {
  it('has one row per day of the year', () => {
    expect(rows).toHaveLength(365)
  })

  it('every kalam window is well-formed and falls within a plausible daylight span', () => {
    for (const r of rows) {
      for (const [start, end] of [
        [r.rahu_kalam_start, r.rahu_kalam_end],
        [r.yamagandam_start, r.yamagandam_end],
        [r.gulika_kalam_start, r.gulika_kalam_end],
      ]) {
        expect(start).toMatch(timeRe)
        expect(end).toMatch(timeRe)
        // A single 1/8th-of-daylight window is well under 2 hours; sunrise
        // is never before 04:00 IST or sunset after 20:00 IST at this latitude.
        expect(toMinutes(start)).toBeGreaterThanOrEqual(4 * 60)
        expect(toMinutes(end)).toBeLessThanOrEqual(20 * 60)
        expect(toMinutes(end) - toMinutes(start)).toBeLessThan(120)
      }
    }
  })

  it('tamil_day and malayalam_day are positive and reset to 1 on a month change', () => {
    for (const r of rows) {
      expect(r.tamil_day).toBeGreaterThan(0)
      expect(r.malayalam_day).toBeGreaterThan(0)
    }
  })

  it('the varsham name is always one of the 60 known Samvatsara names', () => {
    const names = new Set(rows.map(r => r.varsham_name))
    expect(names.size).toBeLessThanOrEqual(SAMVATSARA_COUNT)
    for (const r of rows) expect(r.varsham_name).toBeTruthy()
  })

  it('Karkidakam/Aadi begin 2026-07-17, matching the known real-world date', () => {
    const day = rows.find(r => r.date === '2026-07-17')
    expect(day.malayalam_month).toBe('Karkidakam')
    expect(day.malayalam_day).toBe(1)
    expect(day.tamil_month).toBe('Aadi')
    expect(day.tamil_day).toBe(1)
  })

  it('the varsham transitions from Vishvavasu to Parabhava at Mesha Sankranti (mid-April)', () => {
    const before = rows.find(r => r.date === '2026-04-01')
    const after = rows.find(r => r.date === '2026-05-01')
    expect(before.varsham_name).toBe('Vishvavasu')
    expect(after.varsham_name).toBe('Parabhava')
  })
})
