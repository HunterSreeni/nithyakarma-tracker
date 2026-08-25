import { describe, it, expect } from 'vitest'
import {
  groupNativeMonths, monthCells, monthIndexContaining,
  weekStartOf, weekDates, daysBetween, traditionOf,
} from '../nativeCalendar'

// Real Aavani / Chingam 2026 boundaries: Aadi runs to 16 Aug, Aavani 1 is
// 17 Aug and Aavani 31 is 16 Sep, so Purattasi 1 is 17 Sep.
const row = (date, tamilMonth, tamilDay, malayalamMonth, malayalamDay) => ({
  date, tamil_month: tamilMonth, tamil_day: tamilDay,
  malayalam_month: malayalamMonth, malayalam_day: malayalamDay,
})

const AADI_TAIL = [
  row('2026-08-14', 'Aadi', 29, 'Karkidakam', 29),
  row('2026-08-15', 'Aadi', 30, 'Karkidakam', 30),
  row('2026-08-16', 'Aadi', 31, 'Karkidakam', 31),
]
const AAVANI = Array.from({ length: 31 }, (_, i) =>
  row(`2026-${i < 15 ? '08' : '09'}-${String(i < 15 ? 17 + i : i - 14).padStart(2, '0')}`,
    'Aavani', i + 1, 'Chingam', i + 1))
const PURATTASI_HEAD = [row('2026-09-17', 'Purattasi', 1, 'Kanni', 1)]

describe('groupNativeMonths', () => {
  it('splits rows at the native month boundary, not the Gregorian one', () => {
    const months = groupNativeMonths([...AADI_TAIL, ...AAVANI], 'tamil')
    expect(months.map(m => m.name)).toEqual(['Aadi', 'Aavani'])
    // Aavani spans two Gregorian months and stays one group.
    expect(months[1].startDate).toBe('2026-08-17')
  })

  it('uses the tradition\'s own month field', () => {
    const months = groupNativeMonths([...AADI_TAIL, ...AAVANI], 'malayalam')
    expect(months.map(m => m.name)).toEqual(['Karkidakam', 'Chingam'])
  })

  it('projects the start date back from the first loaded day, not from the row', () => {
    // Only Aadi 29-31 are loaded, but Aadi 1 is still 17 Jul.
    const months = groupNativeMonths([...AADI_TAIL, ...AAVANI], 'tamil')
    expect(months[0].startDate).toBe('2026-07-17')
  })

  it('measures dayCount against the next month when there is one', () => {
    const months = groupNativeMonths([...AAVANI, ...PURATTASI_HEAD], 'tamil')
    expect(months[0].dayCount).toBe(31)
  })

  it('falls back to the highest day seen for the last month in the window', () => {
    const months = groupNativeMonths(AAVANI.slice(0, 20), 'tamil')
    expect(months[0].dayCount).toBe(20)
  })

  it('sorts unordered rows before grouping', () => {
    const months = groupNativeMonths([...AAVANI].reverse(), 'tamil')
    expect(months).toHaveLength(1)
    expect(months[0].startDate).toBe('2026-08-17')
  })

  it('returns nothing for an empty window', () => {
    expect(groupNativeMonths([], 'tamil')).toEqual([])
  })
})

describe('monthCells', () => {
  it('emits one cell per native day, with the row attached where loaded', () => {
    const [aavani] = groupNativeMonths([...AAVANI, ...PURATTASI_HEAD], 'tamil')
    const cells = monthCells(aavani, 'tamil')
    expect(cells).toHaveLength(31)
    expect(cells[0]).toMatchObject({ date: '2026-08-17', nativeDay: 1 })
    expect(cells[30]).toMatchObject({ date: '2026-09-16', nativeDay: 31 })
    expect(cells.every(c => c.row)).toBe(true)
  })

  it('leaves unloaded days as cells with a null row rather than dropping them', () => {
    const [aadi] = groupNativeMonths([...AADI_TAIL, ...AAVANI], 'tamil')
    const cells = monthCells(aadi, 'tamil')
    expect(cells).toHaveLength(31)
    expect(cells.filter(c => c.row === null)).toHaveLength(28)
    expect(cells[0]).toMatchObject({ date: '2026-07-17', nativeDay: 1, row: null })
    expect(cells[30].row?.date).toBe('2026-08-16')
  })
})

describe('monthIndexContaining', () => {
  const months = groupNativeMonths([...AADI_TAIL, ...AAVANI, ...PURATTASI_HEAD], 'tamil')

  it('finds the month a date falls in, including days with no row', () => {
    expect(months[monthIndexContaining(months, '2026-08-23')].name).toBe('Aavani')
    expect(months[monthIndexContaining(months, '2026-07-20')].name).toBe('Aadi')
  })

  it('returns -1 outside the loaded window', () => {
    expect(monthIndexContaining(months, '2026-05-01')).toBe(-1)
  })
})

describe('week helpers', () => {
  it('anchors weeks to Sunday', () => {
    expect(weekStartOf('2026-08-23')).toBe('2026-08-23') // a Sunday
    expect(weekStartOf('2026-08-26')).toBe('2026-08-23')
    expect(weekStartOf('2026-08-22')).toBe('2026-08-16')
  })

  it('returns seven consecutive dates', () => {
    expect(weekDates('2026-08-23')).toEqual([
      '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26',
      '2026-08-27', '2026-08-28', '2026-08-29',
    ])
  })

  it('counts days across a month boundary', () => {
    expect(daysBetween('2026-08-17', '2026-09-16')).toBe(30)
  })
})

describe('traditionOf', () => {
  it('defaults to tamil the way PanchangamBox does', () => {
    expect(traditionOf({ panchangam_tradition: 'malayalam' })).toBe('malayalam')
    expect(traditionOf({ panchangam_tradition: 'tamil' })).toBe('tamil')
    expect(traditionOf({})).toBe('tamil')
    expect(traditionOf(null)).toBe('tamil')
  })
})
