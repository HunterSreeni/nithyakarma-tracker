import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

const admob = {
  initialize: vi.fn(), prepareInterstitial: vi.fn(), showInterstitial: vi.fn(),
  // Default: consent not required (typical non-EEA user) and ads allowed.
  requestConsentInfo: vi.fn(() => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true })),
  showConsentForm: vi.fn(() => ({ status: 'OBTAINED', canRequestAds: true })),
}
vi.mock('@capacitor-community/admob', () => ({
  AdMob: admob,
  MaxAdContentRating: { General: 'General' },
  AdmobConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', REQUIRED: 'REQUIRED', OBTAINED: 'OBTAINED', UNKNOWN: 'UNKNOWN' },
}))

vi.mock('../analytics', () => ({ track: vi.fn() }))

import { isAdFree, showInterstitial, adsAvailable, _resetAdSession } from '../ads'

beforeEach(() => { vi.clearAllMocks(); _resetAdSession() })

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

  it('caps at one interstitial per app session (launch is light)', async () => {
    mockNative.mockReturnValue(true)
    expect(await showInterstitial({ ad_free_until: null })).toBe(true)
    expect(await showInterstitial({ ad_free_until: null })).toBe(false)
    expect(admob.showInterstitial).toHaveBeenCalledTimes(1)
  })

  it('requests only G-rated ads (family / devotional audience)', async () => {
    mockNative.mockReturnValue(true)
    await showInterstitial({ ad_free_until: null })
    expect(admob.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ maxAdContentRating: 'General' }),
    )
  })

  it('shows the UMP consent form when consent is required (EEA/UK)', async () => {
    mockNative.mockReturnValue(true)
    admob.requestConsentInfo.mockResolvedValueOnce({
      status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false,
    })
    admob.showConsentForm.mockResolvedValueOnce({ status: 'OBTAINED', canRequestAds: true })
    const shown = await showInterstitial({ ad_free_until: null })
    expect(admob.showConsentForm).toHaveBeenCalledTimes(1)
    expect(shown).toBe(true)
    expect(admob.showInterstitial).toHaveBeenCalledTimes(1)
  })

  it('shows no ad when the user declines consent', async () => {
    mockNative.mockReturnValue(true)
    admob.requestConsentInfo.mockResolvedValue({
      status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false,
    })
    admob.showConsentForm.mockResolvedValue({ status: 'REQUIRED', canRequestAds: false })
    expect(await showInterstitial({ ad_free_until: null })).toBe(false)
    expect(admob.showInterstitial).not.toHaveBeenCalled()
    // Stays blocked for the rest of the session without re-prompting.
    expect(await showInterstitial({ ad_free_until: null })).toBe(false)
    expect(admob.showConsentForm).toHaveBeenCalledTimes(1)
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
