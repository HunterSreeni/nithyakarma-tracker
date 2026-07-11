import { describe, it, expect } from 'vitest'
import { isScheduled, isDoneToday, cadenceLabel, localDateString, SANDHYA_SLOTS } from '../cadence'

const SUNDAY = new Date('2026-07-05T10:00:00')
const MONDAY = new Date('2026-07-06T10:00:00')

describe('isScheduled', () => {
  it('daily practices are scheduled every day', () => {
    const p = { cadence: 'daily' }
    expect(isScheduled(p, SUNDAY)).toBe(true)
    expect(isScheduled(p, MONDAY)).toBe(true)
  })
  it('weekly practices only appear on their weekday', () => {
    const adityaHrudayam = { cadence: 'weekly', weekday: 0 }
    expect(isScheduled(adityaHrudayam, SUNDAY)).toBe(true)
    expect(isScheduled(adityaHrudayam, MONDAY)).toBe(false)
  })
  it('sequence and count practices are daily', () => {
    expect(isScheduled({ cadence: 'sequence' }, MONDAY)).toBe(true)
    expect(isScheduled({ cadence: 'daily_count' }, MONDAY)).toBe(true)
  })
})

describe('isDoneToday', () => {
  const sandhya = { is_sandhyavandhanam: true }
  it('sandhyavandhanam needs all 3 slots', () => {
    expect(isDoneToday(sandhya, [{ slot: 'morning' }, { slot: 'afternoon' }])).toBe(false)
    expect(isDoneToday(sandhya, [{ slot: 'morning' }, { slot: 'afternoon' }, { slot: 'evening' }])).toBe(true)
  })
  it('a single sandhya slot is NOT done (the reported 0-not-1 case is correct)', () => {
    expect(isDoneToday(sandhya, [])).toBe(false)
    expect(isDoneToday(sandhya, [{ slot: 'morning' }])).toBe(false)
  })
  it('general practice done with a single log', () => {
    expect(isDoneToday({ is_sandhyavandhanam: false }, [])).toBe(false)
    expect(isDoneToday({ is_sandhyavandhanam: false }, [{}])).toBe(true)
  })
})

describe('cadenceLabel', () => {
  it('labels each cadence type', () => {
    expect(cadenceLabel({ cadence: 'weekly', weekday: 0 })).toBe('Sundays')
    expect(cadenceLabel({ cadence: 'daily_count', target_count: 108 })).toBe('daily 108')
    expect(cadenceLabel({ cadence: 'sequence', sequence_length: 100 })).toBe('1 of 100 / day')
    expect(cadenceLabel({ cadence: 'sequence', sequence_length: null })).toBe('daily reading')
    expect(cadenceLabel({ cadence: 'daily', is_sandhyavandhanam: true })).toBe('3 sandhyas daily')
    expect(cadenceLabel({ cadence: 'daily' })).toBe('daily')
  })
})

describe('localDateString', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(localDateString(new Date(2026, 6, 7))).toBe('2026-07-07')
    expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('SANDHYA_SLOTS', () => {
  it('has the 3 slots in order', () => {
    expect(SANDHYA_SLOTS.map(s => s.key)).toEqual(['morning', 'afternoon', 'evening'])
  })
})
