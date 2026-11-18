import { describe, it, expect } from 'vitest'
import { antarams, houseFrom, saturnNow, jupiterNow, chandrashtamam, nextStarBirthday, ageOn } from '../now'
import { siderealLon } from '../astro'
import { NAK_SPAN } from '../chart'
import { sunTimes, solarDate } from '../panchangam'

const NOW = Date.parse('2026-11-18T06:00:00Z')
const CHENNAI = { lat: 13.0878, lon: 80.2785, tz: 'Asia/Kolkata' }
const DAY = 86400000

describe('now', () => {
  it('splits a bhukti into nine antarams starting with its lord', () => {
    const b = { lord: 'Saturn', start: 0, end: 1200 }
    const a = antarams(b)
    expect(a.map((x) => x.lord)).toEqual(['Saturn', 'Mercury', 'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter'])
    expect(a[0].end).toBeCloseTo(190)
    expect(a[8].end).toBeCloseTo(1200)
  })

  it('counts houses from the birth rasi', () => {
    expect(houseFrom(4, 4)).toBe(1)
    expect(houseFrom(4, 11)).toBe(8)
    expect(houseFrom(11, 10)).toBe(12)
  })

  // Saturn has been in sidereal Meenam since March 2025 and moves to Mesham in 2027.
  it('names Saturn transits from the birth rasi', () => {
    expect(saturnNow(11, NOW)).toMatchObject({ house: 1, kind: 'ezharai', phase: 2, phaseName: 'Janma sani' })
    expect(saturnNow(10, NOW)).toMatchObject({ house: 2, kind: 'ezharai', phase: 3 })
    expect(saturnNow(4, NOW)).toMatchObject({ house: 8, kind: 'ashtama' })
    expect(saturnNow(7, NOW)).toMatchObject({ house: 5, kind: null })
    const s = saturnNow(11, NOW)
    expect(new Date(s.signChange).getUTCFullYear()).toBe(2027)
    expect(s.start).toBeLessThan(Date.parse('2023-06-01'))
    expect(new Date(s.end).getUTCFullYear()).toBeGreaterThanOrEqual(2029)
  })

  it('finds when Jupiter next changes sign', () => {
    const j = jupiterNow(0, NOW)
    expect(j.house).toBe(Math.floor(siderealLon('Jupiter', new Date(NOW)) / 30) + 1)
    expect(j.signChange).toBeGreaterThan(NOW)
    expect(j.signChange - NOW).toBeLessThan(400 * DAY)
  })

  it('lists the next chandrashtamam spells, Moon in the 8th from the rasi', () => {
    const spells = chandrashtamam(4, NOW)
    expect(spells).toHaveLength(3)
    for (const s of spells) {
      const mid = new Date((s.start + s.end) / 2)
      expect(Math.floor(siderealLon('Moon', mid) / 30)).toBe(11)
      expect((s.end - s.start) / DAY).toBeGreaterThan(1.9)
      expect((s.end - s.start) / DAY).toBeLessThan(2.8)
      expect(s.end).toBeGreaterThan(NOW)
    }
    expect(spells[1].start - spells[0].start).toBeGreaterThan(26 * DAY)
  })

  it('finds the next star birthday in the birth month, by the star at sunrise', () => {
    const iso = nextStarBirthday({ birthStar: 11, birthMonth: 9, tradition: 'tamil', place: CHENNAI }, NOW)
    expect(iso > '2026-11-18').toBe(true)
    expect(iso < '2027-11-18').toBe(true)
    expect(solarDate(iso, CHENNAI, 'tamil').month).toBe(9) // Thai
    const { sunrise } = sunTimes(iso, CHENNAI)
    expect(Math.floor(siderealLon('Moon', sunrise) / NAK_SPAN)).toBe(11) // Uttara Phalguni
  })

  it('works out age in completed years and months', () => {
    expect(ageOn('1981-02-10', '2026-11-18')).toEqual({ years: 45, months: 9 })
    expect(ageOn('1981-11-20', '2026-11-18')).toEqual({ years: 44, months: 11 })
    expect(ageOn('2026-11-20', '2026-11-18')).toEqual({ years: 0, months: 0 })
  })
})
