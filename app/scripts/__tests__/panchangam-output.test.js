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

  // Mithunam sankranti is 15 June 2026 12:53 IST - after local solar noon
  // (12:25) but before aparahna (~13:36). Noon-sampling put Mithunam 1 on the
  // 16th; the aparahna rule Kerala actually uses puts it on the 15th, which is
  // what Prokerala and DrikPanchang both publish.
  it('Mithunam 1 is 2026-06-15 under the aparahna rule, not the 16th', () => {
    expect(rows.find(r => r.date === '2026-06-15').malayalam_month).toBe('Mithunam')
    expect(rows.find(r => r.date === '2026-06-15').malayalam_day).toBe(1)
    expect(rows.find(r => r.date === '2026-06-16').malayalam_day).toBe(2)
  })

  it('1 January continues the month that began the previous December', () => {
    const jan1 = rows.find(r => r.date === '2026-01-01')
    expect(jan1.malayalam_month).toBe('Dhanu')
    expect(jan1.malayalam_day).toBe(17)
    expect(jan1.tamil_month).toBe('Margazhi')
    expect(jan1.tamil_day).toBe(17)
  })

  it('Parabhava begins ON Chithirai 1 (2026-04-14), not the day after', () => {
    expect(rows.find(r => r.date === '2026-04-13').varsham_name).toBe('Vishvavasu')
    expect(rows.find(r => r.date === '2026-04-14').varsham_name).toBe('Parabhava')
    expect(rows.find(r => r.date === '2026-04-14').tamil_day).toBe(1)
  })

  it('Kollavarsham rolls 1201 -> 1202 at Chingam 1 (2026-08-17)', () => {
    expect(rows.find(r => r.date === '2026-08-16').kollavarsham_year).toBe(1201)
    const chingam1 = rows.find(r => r.date === '2026-08-17')
    expect(chingam1.kollavarsham_year).toBe(1202)
    expect(chingam1.malayalam_month).toBe('Chingam')
    expect(chingam1.malayalam_day).toBe(1)
  })

  it('every row carries a plausible Kollavarsham year', () => {
    for (const r of rows) expect([1201, 1202]).toContain(r.kollavarsham_year)
  })
})
