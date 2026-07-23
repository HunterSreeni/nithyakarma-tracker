import { describe, it, expect } from 'vitest'
import rows from '../panchangam-2027.json'

const SAMVATSARA_COUNT = 60
const timeRe = /^\d{2}:\d{2}$/

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

describe('generated panchangam-2027.json sanity', () => {
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
        expect(toMinutes(start)).toBeGreaterThanOrEqual(4 * 60)
        expect(toMinutes(end)).toBeLessThanOrEqual(20 * 60)
        expect(toMinutes(end) - toMinutes(start)).toBeLessThan(120)
      }
    }
  })

  it('tamil_day and malayalam_day are positive', () => {
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

  // Pinned against the physical Pambu Panchangam (Parabhava year, photographed
  // 23 July 2026), page 18: Tamil day 1 = 15 Jan. Also matches DrikPanchang's
  // exact sankranti moment (15 Jan 2027, 2:45 AM IST - already past midnight
  // into the 15th, so both the sunset and aparahna cutoffs land on the 15th).
  it('Thai 1 (Pongal) is 2027-01-15, matching the printed Pambu Panchangam page 18', () => {
    const day = rows.find(r => r.date === '2027-01-15')
    expect(day.tamil_month).toBe('Thai')
    expect(day.tamil_day).toBe(1)
    expect(rows.find(r => r.date === '2027-01-14').tamil_month).toBe('Margazhi')
  })

  // Same sankranti moment under Kerala's aparahna rule - cross-checked against
  // DrikPanchang directly (not the Tamil-only physical book).
  it('Makaram 1 is 2027-01-15, matching DrikPanchang', () => {
    const day = rows.find(r => r.date === '2027-01-15')
    expect(day.malayalam_month).toBe('Makaram')
    expect(day.malayalam_day).toBe(1)
  })

  // Pinned against the printed Pambu Panchangam page 18, row 23: "தை அமாவாசை"
  // (Thai Amavasai), Tamil day 23.
  it('Thai Amavasya is 2027-02-06, matching the printed Pambu Panchangam page 18', () => {
    const day = rows.find(r => r.date === '2027-02-06')
    expect(day.thithi).toBe('Amavasya')
    expect(day.tamil_month).toBe('Thai')
    expect(day.tamil_day).toBe(23)
  })

  // Pinned against the printed Pambu Panchangam page 20, row 1: Tamil day
  // 1 = 15 March 2027.
  it('Panguni 1 is 2027-03-15, matching the printed Pambu Panchangam page 20', () => {
    const day = rows.find(r => r.date === '2027-03-15')
    expect(day.tamil_month).toBe('Panguni')
    expect(day.tamil_day).toBe(1)
  })

  // Cross-checked against Prokerala/web sources for Chingam 1, 2027.
  it('Chingam 1 is 2027-08-18, matching published Malayalam New Year sources', () => {
    const day = rows.find(r => r.date === '2027-08-18')
    expect(day.malayalam_month).toBe('Chingam')
    expect(day.malayalam_day).toBe(1)
    expect(day.kollavarsham_year).toBe(1203)
  })

  it('1 January continues the month that began the previous December', () => {
    const jan1 = rows.find(r => r.date === '2027-01-01')
    expect(jan1.malayalam_month).toBe('Dhanu')
    expect(jan1.malayalam_day).toBe(17)
    expect(jan1.tamil_month).toBe('Margazhi')
    expect(jan1.tamil_day).toBe(17)
  })

  it('samvatsara rolls Parabhava -> Plavanga at Chithirai 1 (2027-04-14)', () => {
    expect(rows.find(r => r.date === '2027-04-13').varsham_name).toBe('Parabhava')
    const chithirai1 = rows.find(r => r.date === '2027-04-14')
    expect(chithirai1.varsham_name).toBe('Plavanga')
    expect(chithirai1.tamil_day).toBe(1)
  })

  it('Kollavarsham rolls 1202 -> 1203 at Chingam 1 (2027-08-18)', () => {
    expect(rows.find(r => r.date === '2027-08-17').kollavarsham_year).toBe(1202)
    expect(rows.find(r => r.date === '2027-08-18').kollavarsham_year).toBe(1203)
  })

  it('every row carries a plausible Kollavarsham year', () => {
    for (const r of rows) expect([1202, 1203]).toContain(r.kollavarsham_year)
  })
})
