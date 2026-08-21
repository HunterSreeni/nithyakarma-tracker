import { describe, it, expect } from 'vitest'
import { isScheduled, isDoneToday, cadenceLabel, localDateString, SANDHYA_SLOTS, RUDRAM_SLOTS } from '../cadence'

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
  it('sandhyavandhanam is done once any 1 of 3 slots is marked (2026-07-20: meet-users-where-they-are change)', () => {
    expect(isDoneToday(sandhya, [])).toBe(false)
    expect(isDoneToday(sandhya, [{ slot: 'morning' }])).toBe(true)
    expect(isDoneToday(sandhya, [{ slot: 'morning' }, { slot: 'afternoon' }])).toBe(true)
    expect(isDoneToday(sandhya, [{ slot: 'morning' }, { slot: 'afternoon' }, { slot: 'evening' }])).toBe(true)
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
    expect(cadenceLabel({ cadence: 'daily', is_sandhyavandhanam: true })).toBe('1 sandhya today')
    expect(cadenceLabel({ cadence: 'daily' })).toBe('daily')
  })

  it('shows a weekday as an informational hint, not a gate, once cadence is daily (2026-08-11: Sri Rudram and 4 others reclassified from weekly)', () => {
    expect(cadenceLabel({ cadence: 'daily', weekday: 1, is_sri_rudram: true })).toBe('any 1 today · traditionally Mondays')
    expect(cadenceLabel({ cadence: 'daily', weekday: 5 })).toBe('daily · traditionally Fridays')
  })

  it('Samidhadhanam shares Sri Rudram\'s any-1-of-N label (Intent 2.9)', () => {
    expect(cadenceLabel({ cadence: 'daily', is_samidhadhanam: true })).toBe('any 1 today')
  })

  it('sandhya keeps its own label with no weekday hint (weekday is always null for it)', () => {
    expect(cadenceLabel({ cadence: 'daily', is_sandhyavandhanam: true, weekday: null })).toBe('1 sandhya today')
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

describe('RUDRAM_SLOTS', () => {
  it('has the 3 slots in order', () => {
    expect(RUDRAM_SLOTS.map(s => s.key)).toEqual(['namakam', 'chamakam', 'both'])
  })
})
