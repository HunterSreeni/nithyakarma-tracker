import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readHistoryCache, writeHistoryCache, clearHistoryCache } from '../historyCache'

const OWNER = 'owner-1'
const days = [{ date: '2026-08-10', items: [{ p: { slug: 'sandhya' }, slots: 1 }] }]

beforeEach(() => { localStorage.clear() })

describe('round trip', () => {
  it('returns what was written for the same subject', () => {
    writeHistoryCache(OWNER, null, days)
    expect(readHistoryCache(OWNER, null)).toEqual(days)
  })

  it('keeps the account holder and a child apart', () => {
    writeHistoryCache(OWNER, 'kid-1', days)
    expect(readHistoryCache(OWNER, null)).toBeNull()
    expect(readHistoryCache(OWNER, 'kid-2')).toBeNull()
    expect(readHistoryCache(OWNER, 'kid-1')).toEqual(days)
  })

  it('treats undefined and null familyMemberId as the same subject', () => {
    writeHistoryCache(OWNER, undefined, days)
    expect(readHistoryCache(OWNER, null)).toEqual(days)
  })

  it('ignores a cache belonging to a different account', () => {
    writeHistoryCache(OWNER, null, days)
    expect(readHistoryCache('someone-else', null)).toBeNull()
  })

  it('returns an empty list as-is, not null - "nothing logged yet" is real data', () => {
    writeHistoryCache(OWNER, null, [])
    expect(readHistoryCache(OWNER, null)).toEqual([])
  })
})

describe('falls back to null rather than showing something wrong', () => {
  it('when there is no cache at all', () => {
    expect(readHistoryCache(OWNER, null)).toBeNull()
  })

  it('when the stored JSON is corrupt', () => {
    localStorage.setItem('nk_history_cache_v1', '{not json')
    expect(readHistoryCache(OWNER, null)).toBeNull()
  })

  it('when the payload is the wrong shape', () => {
    localStorage.setItem('nk_history_cache_v1', JSON.stringify({ userId: OWNER, days: 'nope' }))
    expect(readHistoryCache(OWNER, null)).toBeNull()
  })

  it('after being cleared', () => {
    writeHistoryCache(OWNER, null, days)
    clearHistoryCache()
    expect(readHistoryCache(OWNER, null)).toBeNull()
  })
})

describe('storage failures never break the caller', () => {
  it('survives setItem throwing (quota / private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeHistoryCache(OWNER, null, days)).not.toThrow()
    spy.mockRestore()
  })

  it('survives getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readHistoryCache(OWNER, null)).toBeNull()
    spy.mockRestore()
  })
})
