// Closes gaps found by mutation testing (Stryker, 2026-11-18): logic paths the
// other suites did not pin, and every name table, so a verified Tamil or
// Malayalam label cannot change by accident.
import { describe, it, expect } from 'vitest'
import { buildChart, nakshatraOf, RASIS, NAKSHATRAS, GRAHAS, RASI_LORDS, NAK_SPAN } from '../chart'
import { isRetrograde, siderealLon } from '../astro'
import { tithiYogaKarana, sunTimes, WEEKDAYS, TAMIL_MONTHS, MALAYALAM_MONTHS, YOGAS, SAMVATSARA } from '../panchangam'
import { antarams, saturnNow, jupiterNow, chandrashtamam, nextStarBirthday, ageOn } from '../now'

const CHENNAI = { lat: 13.0878, lon: 80.2785, tz: 'Asia/Kolkata' }
const NOW = Date.parse('2026-11-18T06:00:00Z')
const DAY = 86400000
// 5 Nov 2026, 9:15 AM IST in Chennai: Moon 29 deg 49 min Simham, close to the pada 1/2 edge.
const BIRTH = new Date('2026-11-05T03:45:00Z')

describe('chart details', () => {
  it('measures the distance to the nearest pada edge', () => {
    expect(nakshatraOf(3.3)).toMatchObject({ index: 0, pada: 1 })
    expect(nakshatraOf(3.3).toPadaEdge).toBeCloseTo(NAK_SPAN / 4 - 3.3, 6)
    expect(nakshatraOf(4.0).toPadaEdge).toBeCloseTo(4.0 - NAK_SPAN / 4, 6) // just into pada 2
    expect(nakshatraOf(4.0).pada).toBe(2)
  })

  it('fills degree in rasi, vakra and only the warnings that apply', () => {
    const c = buildChart({ utc: BIRTH, lat: CHENNAI.lat, lon: CHENNAI.lon })
    for (const g of c.grahas) {
      expect(g.degInRasi).toBeCloseTo(g.lon % 30, 9)
      expect(g.degInRasi).toBeLessThan(30)
    }
    const vakra = Object.fromEntries(c.grahas.map((g) => [g.key, g.vakra]))
    expect(vakra).toMatchObject({ Mercury: true, Venus: true, Saturn: true, Mars: false, Jupiter: false, Sun: false, Moon: false, Rahu: false })
    expect(vakra.Mercury).toBe(isRetrograde('Mercury', BIRTH))
    expect(c.warnings).toEqual(['moon-edge'])
  })

  it('warns when the lagna sits near a sign edge', () => {
    // Step through a morning a minute at a time until the lagna is within 0.5 deg of a sign start.
    let found = null
    for (let m = 0; m < 240 && !found; m++) {
      const utc = new Date(BIRTH.getTime() + m * 60000)
      const c = buildChart({ utc, lat: CHENNAI.lat, lon: CHENNAI.lon })
      const lagna = c.grahas.find((g) => g.key === 'Lagna').degInRasi
      if (lagna < 0.5) found = c
    }
    expect(found.warnings).toContain('lagna-edge')
  })
})

describe('now details', () => {
  it('splits a bhukti that does not start at zero', () => {
    const a = antarams({ lord: 'Ketu', start: 1000, end: 2200 })
    expect(a[0]).toEqual({ lord: 'Ketu', start: 1000, end: 1070 })
    expect(a[8].end).toBeCloseTo(2200)
  })

  it('names Arthashtama sani (Saturn in the 4th)', () => {
    expect(saturnNow(8, NOW)).toMatchObject({ house: 4, kind: 'arthashtama' })
  })

  it('finds the exact moment Jupiter changes sign', () => {
    const j = jupiterNow(0, NOW)
    const sign = (ms) => Math.floor(siderealLon('Jupiter', new Date(ms)) / 30)
    expect(sign(j.signChange - 3600000)).toBe(sign(NOW))
    expect(sign(j.signChange + 3600000)).not.toBe(sign(NOW))
  })

  it('includes a chandrashtamam spell that is already running', () => {
    const [first] = chandrashtamam(4, NOW)
    const during = (first.start + first.end) / 2
    const spells = chandrashtamam(4, during)
    expect(spells).toHaveLength(3)
    expect(Math.abs(spells[0].start - first.start)).toBeLessThan(120000)
    expect(Math.abs(spells[0].end - first.end)).toBeLessThan(120000)
    expect(spells[1].start - spells[0].end).toBeGreaterThan(20 * DAY)
  })

  it('uses the star 6 nazhigai after sunrise for Kerala star birthdays', () => {
    const iso = nextStarBirthday({ birthStar: 11, birthMonth: 9, tradition: 'kerala', place: CHENNAI }, NOW)
    const { sunrise } = sunTimes(iso, CHENNAI)
    expect(Math.floor(siderealLon('Moon', new Date(sunrise.getTime() + 144 * 60000)) / NAK_SPAN)).toBe(11)
  })

  it('counts a birthday month as complete on the day itself', () => {
    expect(ageOn('1981-02-10', '2026-02-10')).toEqual({ years: 45, months: 0 })
    expect(ageOn('1981-02-10', '2026-02-09')).toEqual({ years: 44, months: 11 })
  })
})

describe('karana boundaries', () => {
  it('switches to the fixed karanas at the end of Amavasya', () => {
    expect(tithiYogaKarana(0, 341).karana).toBe('Vishti') // k = 56, last movable
    expect(tithiYogaKarana(0, 342).karana).toBe('Shakuni') // k = 57
    expect(tithiYogaKarana(0, 348).karana).toBe('Chatushpada')
  })
})

describe('name tables (verified labels, pinned)', () => {
  it('keeps every rasi, star, planet, weekday, month, yoga and samvatsara name', () => {
    expect({
      rasis: RASIS, nakshatras: NAKSHATRAS, grahas: GRAHAS, rasiLords: RASI_LORDS, weekdays: WEEKDAYS,
      tamilMonths: TAMIL_MONTHS, malayalamMonths: MALAYALAM_MONTHS, yogas: YOGAS, samvatsara: SAMVATSARA,
      tithis: Array.from({ length: 30 }, (_, t) => tithiYogaKarana(0, t * 12 + 1).tithi),
      karanas: Array.from({ length: 60 }, (_, k) => tithiYogaKarana(0, k * 6 + 1).karana),
    }).toMatchSnapshot()
  })
})
