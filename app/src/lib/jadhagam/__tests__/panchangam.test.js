import { describe, it, expect } from 'vitest'
import y2026 from '../../../../scripts/panchangam-2026.json'
import y2027 from '../../../../scripts/panchangam-2027.json'
import { solarDate, yearNames, tithiYogaKarana, birthPanchangam, sunTimes, TAMIL_MONTHS, MALAYALAM_MONTHS } from '../panchangam'
import { siderealLon } from '../astro'
import { zonedToUtc } from '../time'

// The panchangam generator's reference place (scripts/generate-panchangam.cjs).
const KOCHI = { lat: 9.9312, lon: 76.2673, tz: 'Asia/Kolkata' }
const CHENNAI = { lat: 13.0878, lon: 80.2785, tz: 'Asia/Kolkata' }
const rows = [...y2026, ...y2027]
const atNoon = (iso, place) => {
  const [year, month, day] = iso.split('-').map(Number)
  // Local solar noon at the place, as the generator samples it.
  return new Date(Date.UTC(year, month - 1, day, 12) - (place.lon / 15) * 3600000)
}

describe('solar month and date match the swisseph panchangam generator', () => {
  it('Tamil (sunset rule) for every day of 2026 and 2027', () => {
    const misses = rows.filter((r) => {
      const s = solarDate(r.date, KOCHI, 'tamil')
      return TAMIL_MONTHS[s.month].en !== r.tamil_month || s.day !== r.tamil_day
    }).map((r) => r.date)
    expect(misses).toEqual([])
  })

  it('Kerala (aparahna rule) for every day of 2026 and 2027', () => {
    const misses = rows.filter((r) => {
      const s = solarDate(r.date, KOCHI, 'kerala')
      return MALAYALAM_MONTHS[s.month] !== r.malayalam_month || s.day !== r.malayalam_day
    }).map((r) => r.date)
    expect(misses).toEqual([])
  })

  it('samvatsara and Kollam year for every day of 2026 and 2027', () => {
    const misses = rows.filter((r) => {
      const y = yearNames(r.date, KOCHI)
      return y.samvatsara !== r.varsham_name || y.kollamYear !== r.kollavarsham_year
    }).map((r) => r.date)
    expect(misses).toEqual([])
  })

  it('keeps the two rules apart: Thai 1 2026 is 14 Jan in Tamil Nadu', () => {
    expect(solarDate('2026-01-14', CHENNAI, 'tamil')).toEqual({ month: 9, day: 1 })
  })
})

describe('tithi', () => {
  it('matches the generator at local noon for every day of 2026 and 2027', () => {
    const misses = rows.filter((r) => {
      const t = atNoon(r.date, KOCHI)
      return tithiYogaKarana(siderealLon('Sun', t), siderealLon('Moon', t)).tithi !== r.thithi
    }).map((r) => r.date)
    // Exact today. If an ephemeris update ever flips a day sitting within a minute of
    // a tithi boundary, check that date by hand before loosening this.
    expect(misses).toEqual([])
  })

  it('names yoga and karana from the longitudes', () => {
    expect(tithiYogaKarana(0, 0)).toMatchObject({ tithi: 'Shukla Pratipada', yoga: 'Vishkambha', karana: 'Kimstughna' })
    expect(tithiYogaKarana(0, 7)).toMatchObject({ tithi: 'Shukla Pratipada', karana: 'Bava' })
    expect(tithiYogaKarana(0, 180)).toMatchObject({ tithi: 'Krishna Pratipada', paksha: 'Krishna' })
    expect(tithiYogaKarana(0, 355)).toMatchObject({ tithi: 'Amavasya', karana: 'Naga' })
    expect(tithiYogaKarana(100, 200).yoga).toBe('Shubha')
    expect(tithiYogaKarana(100, 250).yoga).toBe('Vaidhriti')
  })
})

describe('birthPanchangam', () => {
  const at = (iso, hour, minute) => zonedToUtc({ ...Object.fromEntries(['year', 'month', 'day'].map((k, i) => [k, Number(iso.split('-')[i])])), hour, minute }, 'Asia/Kolkata')

  it('counts nazhigai from sunrise and uses the sunrise weekday', () => {
    const { sunrise } = sunTimes('2026-11-18', CHENNAI)
    const birth = new Date(sunrise.getTime() + 90 * 60000) // 1h30 after sunrise
    const p = birthPanchangam(birth, CHENNAI)
    expect(p.hinduDate).toBe('2026-11-18')
    expect(p.weekday).toBe(3) // Wednesday
    expect(p.nazhigai).toEqual({ nazhigai: 3, vinadi: 45 })
  })

  it('puts a birth before sunrise on the previous Hindu day', () => {
    const p = birthPanchangam(at('2026-11-18', 3, 0), CHENNAI)
    expect(p.hinduDate).toBe('2026-11-17')
    expect(p.weekday).toBe(2) // Tuesday
    expect(p.nazhigai.nazhigai).toBeGreaterThan(50)
    // Sunrise and sunset both belong to that previous day.
    expect(p.sunrise).toEqual(sunTimes('2026-11-17', CHENNAI).sunrise)
    expect(p.sunset).toEqual(sunTimes('2026-11-17', CHENNAI).sunset)
  })

  it('gives sunrise and sunset around 6 and 6 in Chennai', () => {
    const { sunrise, sunset } = sunTimes('2026-11-18', CHENNAI)
    const ist = (d) => (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440
    expect(ist(sunrise)).toBeGreaterThan(5 * 60 + 50)
    expect(ist(sunrise)).toBeLessThan(6 * 60 + 15)
    expect(ist(sunset)).toBeGreaterThan(17 * 60 + 30)
    expect(ist(sunset)).toBeLessThan(17 * 60 + 55)
  })
})

describe('planet badges', async () => {
  const { dignity } = await import('../chart')
  const { isRetrograde } = await import('../astro')

  it('reads the classical sign table', () => {
    expect(dignity('Moon', 1)).toBe('exalted')
    expect(dignity('Moon', 7)).toBe('debilitated')
    expect(dignity('Saturn', 10)).toBe('own')
    expect(dignity('Mercury', 5)).toBe('exalted') // exalted beats own sign
    expect(dignity('Sun', 2)).toBeNull()
    expect(dignity('Rahu', 1)).toBeNull()
  })

  it('marks vakra from motion: Jupiter retrograde Nov 2025 to Mar 2026', () => {
    expect(isRetrograde('Jupiter', new Date('2026-01-01T00:00:00Z'))).toBe(true)
    expect(isRetrograde('Jupiter', new Date('2026-06-01T00:00:00Z'))).toBe(false)
  })
})

describe('label tables', async () => {
  const { RASIS, NAKSHATRAS, GRAHAS } = await import('../chart')
  const { WEEKDAYS } = await import('../panchangam')
  const ML = /^[ഀ-ൿ]+$/

  it('have a Malayalam name for every rasi, star, planet and weekday', () => {
    for (const x of [...RASIS, ...NAKSHATRAS, ...GRAHAS, ...WEEKDAYS]) expect(x.ml).toMatch(ML)
    for (const g of GRAHAS) expect(g.mlShort).toMatch(ML)
    expect(new Set(GRAHAS.map((g) => g.mlShort)).size).toBe(10) // no two planets share a letter
    expect(RASIS.map((r) => r.ml).slice(0, 3)).toEqual(['മേടം', 'ഇടവം', 'മിഥുനം'])
    expect(NAKSHATRAS[21].ml).toBe('തിരുവോണം')
  })
})
