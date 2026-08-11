import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readReferralsCache, writeReferralsCache, clearReferralsCache } from '../referralsCache'

const OWNER = 'owner-1'
const rows = [{ referred_id: 'r1', display_name: 'Arjun', joined_at: '2026-08-01' }]

beforeEach(() => { localStorage.clear() })

describe('round trip', () => {
  it('returns what was written for the same owner', () => {
    writeReferralsCache(OWNER, rows)
    expect(readReferralsCache(OWNER)).toEqual(rows)
  })

  it('ignores a cache belonging to a different account', () => {
    writeReferralsCache(OWNER, rows)
    expect(readReferralsCache('someone-else')).toBeNull()
  })

  it('returns an empty list as-is, not null - "no referrals yet" is real data', () => {
    writeReferralsCache(OWNER, [])
    expect(readReferralsCache(OWNER)).toEqual([])
  })
})

describe('falls back to null rather than showing something wrong', () => {
  it('when there is no cache at all', () => {
    expect(readReferralsCache(OWNER)).toBeNull()
  })

  it('when the stored JSON is corrupt', () => {
    localStorage.setItem('nk_referrals_cache_v1', '{not json')
    expect(readReferralsCache(OWNER)).toBeNull()
  })

  it('when the payload is the wrong shape', () => {
    localStorage.setItem('nk_referrals_cache_v1', JSON.stringify({ userId: OWNER, rows: 'nope' }))
    expect(readReferralsCache(OWNER)).toBeNull()
  })

  it('after being cleared', () => {
    writeReferralsCache(OWNER, rows)
    clearReferralsCache()
    expect(readReferralsCache(OWNER)).toBeNull()
  })
})

describe('storage failures never break the caller', () => {
  it('survives setItem throwing (quota / private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeReferralsCache(OWNER, rows)).not.toThrow()
    spy.mockRestore()
  })

  it('survives getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readReferralsCache(OWNER)).toBeNull()
    spy.mockRestore()
  })
})
