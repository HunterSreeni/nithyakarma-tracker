// The Today-list cache is what makes a reopen paint instantly instead of
// sitting on a spinner, so its "when is this safe to show" rules are the whole
// point. Anything it returns is rendered as if it were live data.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readTodayCache, writeTodayCache, clearTodayCache } from '../todayCache'

const OWNER = 'owner-1'
const MON = new Date(2026, 7, 10) // Monday 2026-08-10, getDay() === 1
const TUE = new Date(2026, 7, 11)

const daily = (id, over = {}) => ({
  up: { id },
  practice: { id, cadence: 'daily', is_sandhyavandhanam: false, ...over },
  logs: [{ id: `log-${id}`, counts_toward_streak: true }],
})

beforeEach(() => { localStorage.clear() })

describe('round trip', () => {
  it('returns what was written for the same subject on the same day', () => {
    writeTodayCache(OWNER, null, [daily('a')], MON)
    const got = readTodayCache(OWNER, null, MON)
    expect(got).toHaveLength(1)
    expect(got[0].logs).toHaveLength(1)
  })

  it('keeps the account holder and a child apart', () => {
    writeTodayCache(OWNER, 'kid-1', [daily('a')], MON)
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
    expect(readTodayCache(OWNER, 'kid-2', MON)).toBeNull()
    expect(readTodayCache(OWNER, 'kid-1', MON)).toHaveLength(1)
  })

  it('treats undefined and null familyMemberId as the same subject', () => {
    writeTodayCache(OWNER, undefined, [daily('a')], MON)
    expect(readTodayCache(OWNER, null, MON)).toHaveLength(1)
  })

  it('ignores a cache belonging to a different account', () => {
    writeTodayCache(OWNER, null, [daily('a')], MON)
    expect(readTodayCache('someone-else', null, MON)).toBeNull()
  })
})

describe('day rollover', () => {
  // Showing yesterday's ticks would tell the user they had already practised
  // today. The practices are still right, only the logs are not.
  it('drops logs from an earlier day but keeps the practices', () => {
    writeTodayCache(OWNER, null, [daily('a')], MON)
    const got = readTodayCache(OWNER, null, TUE)
    expect(got).toHaveLength(1)
    expect(got[0].logs).toEqual([])
  })

  it('keeps logs when the cache is from today', () => {
    writeTodayCache(OWNER, null, [daily('a')], MON)
    expect(readTodayCache(OWNER, null, MON)[0].logs).toHaveLength(1)
  })
})

describe('cadence re-filtering', () => {
  it('hides a weekly practice cached on its own weekday once the day moves on', () => {
    const weekly = daily('w', { cadence: 'weekly', weekday: 1 }) // Monday
    writeTodayCache(OWNER, null, [weekly], MON)
    expect(readTodayCache(OWNER, null, MON)).toHaveLength(1)
    expect(readTodayCache(OWNER, null, TUE)).toBeNull()
  })

  it('keeps a weekly practice on the weekday it is scheduled', () => {
    const weekly = daily('w', { cadence: 'weekly', weekday: 2 }) // Tuesday
    writeTodayCache(OWNER, null, [weekly], MON)
    expect(readTodayCache(OWNER, null, TUE)).toHaveLength(1)
  })

  it('sorts sandhyavandhanam first, matching the live load', () => {
    writeTodayCache(OWNER, null, [daily('a'), daily('s', { is_sandhyavandhanam: true })], MON)
    expect(readTodayCache(OWNER, null, MON)[0].practice.is_sandhyavandhanam).toBe(true)
  })
})

describe('falls back to null rather than showing something wrong', () => {
  it('when there is no cache at all', () => {
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
  })

  it('when the stored JSON is corrupt', () => {
    localStorage.setItem('nk_today_cache_v1', '{not json')
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
  })

  it('when the payload is the wrong shape', () => {
    localStorage.setItem('nk_today_cache_v1', JSON.stringify({ userId: OWNER, items: 'nope' }))
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
  })

  // An empty list would render the "start with a suggested anushtanam" empty
  // state for a beat before the real list arrives, which reads as data loss.
  it('when nothing survives the cadence filter, instead of an empty list', () => {
    writeTodayCache(OWNER, null, [daily('w', { cadence: 'weekly', weekday: 1 })], MON)
    expect(readTodayCache(OWNER, null, TUE)).toBeNull()
  })

  it('after being cleared', () => {
    writeTodayCache(OWNER, null, [daily('a')], MON)
    clearTodayCache()
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
  })
})

describe('storage failures never break the caller', () => {
  it('survives setItem throwing (quota / private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeTodayCache(OWNER, null, [daily('a')], MON)).not.toThrow()
    spy.mockRestore()
  })

  it('survives getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readTodayCache(OWNER, null, MON)).toBeNull()
    spy.mockRestore()
  })
})
