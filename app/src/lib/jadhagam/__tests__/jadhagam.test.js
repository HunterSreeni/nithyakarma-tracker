import { describe, it, expect } from 'vitest'
import { lahiriAyanamsa, siderealPositions, norm360 } from '../astro'
import { nakshatraOf, navamsaIndex, rasiIndex, buildChart, formatDeg, NAK_SPAN } from '../chart'
import { dasaBalance, dasaTimeline, currentPeriod, formatYears, YEAR_MS } from '../dasa'
import { zonedToUtc, offsetAt, utcOffsetLabel } from '../time'
import { searchPlaces } from '../places'

const arcmin = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 60

describe('Lahiri ayanamsa', () => {
  it('matches the Swiss Ephemeris definition at its epoch and at J2000', () => {
    expect(lahiriAyanamsa((2435553.5 - 2451545) / 36525)).toBeCloseTo(23.245524743, 9)
    expect(lahiriAyanamsa(0)).toBeCloseTo(23.85706, 4) // 23°51'25"
  })
})

describe('sidereal positions (physical checks, no oracle needed)', () => {
  it('puts Sun and Moon together at a new moon and opposite at a full moon', () => {
    // New moon 2000-01-06 18:14 UTC, full moon 2000-01-21 04:40 UTC (published lunation times).
    const nm = siderealPositions(new Date(Date.UTC(2000, 0, 6, 18, 14)), 13.08, 80.27).positions
    expect(arcmin(nm.Moon, nm.Sun)).toBeLessThan(2)
    const fm = siderealPositions(new Date(Date.UTC(2000, 0, 21, 4, 40)), 13.08, 80.27).positions
    expect(arcmin(fm.Moon, norm360(fm.Sun + 180))).toBeLessThan(2)
  })

  it('has the lagna next to the Sun at sunrise', () => {
    // Chennai, 2024-04-14: sunrise about 05:59 IST (00:29 UTC).
    const p = siderealPositions(new Date(Date.UTC(2024, 3, 14, 0, 29)), 13.08, 80.27).positions
    expect(arcmin(p.Lagna, p.Sun)).toBeLessThan(90)
  })

  it('keeps Rahu and Ketu opposite', () => {
    const p = siderealPositions(new Date(Date.UTC(1990, 5, 1)), 10, 76).positions
    expect(arcmin(p.Ketu, norm360(p.Rahu + 180))).toBeLessThan(0.001)
  })
})

describe('chart helpers', () => {
  it('splits the zodiac into nakshatras, padas, rasis and navamsas', () => {
    expect(nakshatraOf(0)).toMatchObject({ index: 0, pada: 1 })
    expect(nakshatraOf(NAK_SPAN * 10 + 5)).toMatchObject({ index: 10, pada: 2 }) // Purva Phalguni 2nd pada
    expect(nakshatraOf(359.99)).toMatchObject({ index: 26, pada: 4 })
    expect(rasiIndex(200)).toBe(6) // Thulam
    expect(navamsaIndex(0)).toBe(0)
    expect(navamsaIndex(30)).toBe(9) // Rishabam starts its navamsas from Magaram
    expect(navamsaIndex(95)).toBe(4) // Kadagam 5° -> Simham amsam
    expect(formatDeg(12.25)).toBe('12°15′')
    expect(formatDeg(5.9999)).toBe('6°00′')
  })

  it('builds a full chart with houses counted from the lagna', () => {
    const c = buildChart({ utc: new Date(Date.UTC(2010, 2, 1, 6, 0)), lat: 13.08, lon: 80.27 })
    expect(c.grahas).toHaveLength(10)
    const lagna = c.grahas.find((g) => g.key === 'Lagna')
    expect(lagna.house).toBe(1)
    for (const g of c.grahas) expect(g.house).toBe(((g.rasi - c.lagna + 12) % 12) + 1)
    expect(c.star.rasi).toBe(rasiIndex(c.moonLon))
  })

  it('warns when the Moon sits near a pada edge', () => {
    // Search a day for a moment within 0.5 deg of a pada edge; the Moon moves ~13 deg a day.
    let found = null
    for (let h = 0; h < 48 && !found; h++) {
      const c = buildChart({ utc: new Date(Date.UTC(2015, 6, 1, h)), lat: 10, lon: 76 })
      if (c.warnings.includes('moon-edge')) found = c
    }
    expect(found).not.toBeNull()
  })
})

describe('Vimshottari dasa', () => {
  it('starts Ketu at the beginning of Ashwini with the full 7 years', () => {
    expect(dasaBalance(0)).toEqual({ lord: 0, years: 7 })
  })

  it('gives Rahu three quarters of 18 years for a Moon a quarter into Swati', () => {
    const b = dasaBalance(190)
    expect(b.lord).toBe(5)
    expect(b.years).toBeCloseTo(13.5, 9)
    expect(formatYears(b.years)).toBe('13y 6m 0d')
  })

  it('lays out nine contiguous mahadasas of 120 years, each with nine bhuktis', () => {
    const birth = Date.UTC(1981, 1, 10, 3, 45)
    const t = dasaTimeline(190, birth)
    expect(t.periods).toHaveLength(9)
    expect(t.periods[0].lord).toBe('Rahu')
    expect(t.periods[0].end - birth).toBeCloseTo(t.balance.years * YEAR_MS, -3)
    expect((t.periods[8].end - t.periods[0].start) / YEAR_MS).toBeCloseTo(120, 6)
    for (const p of t.periods) {
      expect(p.bhuktis).toHaveLength(9)
      expect(p.bhuktis[0].lord).toBe(p.lord)
      expect(p.bhuktis[0].start).toBe(p.start)
      expect(p.bhuktis[8].end).toBeCloseTo(p.end, -2)
    }
    const at = Date.UTC(2026, 10, 15)
    const now = currentPeriod(t, at)
    expect(at >= now.md.start && at < now.md.end).toBe(true)
    expect(at >= now.bhukti.start && at < now.bhukti.end).toBe(true)
    expect(currentPeriod(t, t.periods[8].end + 1)).toBeNull()
  })

  it('rolls 30 days into a month when formatting', () => {
    expect(formatYears(1 + 11.9999 / 12)).toBe('2y 0m 0d')
  })
})

describe('birth time zones', () => {
  it('converts Indian Standard Time', () => {
    const d = zonedToUtc({ year: 1981, month: 2, day: 10, hour: 9, minute: 15 }, 'Asia/Kolkata')
    expect(d.toISOString()).toBe('1981-02-10T03:45:00.000Z')
    expect(utcOffsetLabel(offsetAt(d, 'Asia/Kolkata'))).toBe('UTC+05:30')
  })

  it('uses the war-time offset for 1943 births', () => {
    const d = zonedToUtc({ year: 1943, month: 1, day: 1, hour: 12, minute: 0 }, 'Asia/Kolkata')
    expect(utcOffsetLabel(offsetAt(d, 'Asia/Kolkata'))).toBe('UTC+06:30')
    expect(d.toISOString()).toBe('1943-01-01T05:30:00.000Z')
  })

  it('lets the user override the offset', () => {
    const d = zonedToUtc({ year: 1950, month: 1, day: 1, hour: 6, minute: 0 }, 'Asia/Kolkata', 330)
    expect(d.toISOString()).toBe('1950-01-01T00:30:00.000Z')
  })
})

describe('place search', () => {
  it('finds towns by prefix, bigger towns first, ignoring case and spaces', () => {
    const r = searchPlaces('thrissur')
    expect(r[0]).toMatchObject({ name: 'Thrissur', state: 'Kerala', tz: 'Asia/Kolkata' })
    expect(searchPlaces('chen')[0].name).toBe('Chennai')
    expect(searchPlaces('a')).toEqual([])
  })
})
