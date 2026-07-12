import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

const admob = {
  initialize: vi.fn(), prepareInterstitial: vi.fn(), showInterstitial: vi.fn(),
}
vi.mock('@capacitor-community/admob', () => ({ AdMob: admob }))

vi.mock('../analytics', () => ({ track: vi.fn() }))

import { isAdFree, showInterstitial, adsAvailable } from '../ads'

beforeEach(() => vi.clearAllMocks())

describe('isAdFree', () => {
  const today = new Date('2026-07-07T12:00:00')
  it('false with no ad_free_until', () => {
    expect(isAdFree({ ad_free_until: null }, today)).toBe(false)
    expect(isAdFree(null, today)).toBe(false)
  })
  it('true when ad_free_until is today or later', () => {
    expect(isAdFree({ ad_free_until: '2026-07-07' }, today)).toBe(true)
    expect(isAdFree({ ad_free_until: '2026-08-01' }, today)).toBe(true)
  })
  it('false when expired', () => {
    expect(isAdFree({ ad_free_until: '2026-07-06' }, today)).toBe(false)
  })
})

describe('showInterstitial', () => {
  it('is a no-op on web (ads are Android-only)', async () => {
    mockNative.mockReturnValue(false)
    const shown = await showInterstitial({ ad_free_until: null })
    expect(shown).toBe(false)
    expect(admob.showInterstitial).not.toHaveBeenCalled()
  })
  it('skips ad-free users on native', async () => {
    mockNative.mockReturnValue(true)
    const future = new Date(); future.setDate(future.getDate() + 10)
    const shown = await showInterstitial({ ad_free_until: future.toISOString().slice(0, 10) })
    expect(shown).toBe(false)
    expect(admob.showInterstitial).not.toHaveBeenCalled()
  })
  it('shows on native for non-ad-free users', async () => {
    mockNative.mockReturnValue(true)
    const shown = await showInterstitial({ ad_free_until: null })
    expect(shown).toBe(true)
    expect(admob.prepareInterstitial).toHaveBeenCalled()
    expect(admob.showInterstitial).toHaveBeenCalledTimes(1)
  })
  it('never throws if the ad SDK fails (submit already saved)', async () => {
    mockNative.mockReturnValue(true)
    admob.showInterstitial.mockRejectedValueOnce(new Error('no fill'))
    const shown = await showInterstitial({ ad_free_until: null })
    expect(shown).toBe(false)
  })
})

describe('adsAvailable', () => {
  it('reflects the platform', () => {
    mockNative.mockReturnValue(false)
    expect(adsAvailable()).toBe(false)
    mockNative.mockReturnValue(true)
    expect(adsAvailable()).toBe(true)
  })
})
