import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
const mockPlatform = vi.fn(() => 'android')
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => mockPlatform() },
}))

// Rewarded video: listeners registered per event, fired by the test.
const listeners = {}
// Like Capacitor's real plugin proxy: any unknown method, including the .then a
// Promise looks for when the plugin is returned from an async function, throws.
const plugin = (methods) => new Proxy(methods, {
  get: (t, k) => (k in t ? t[k] : k === 'then'
    ? () => { throw new Error('"AdMob.then()" is not implemented on android') }
    : undefined),
})
const admob = plugin({
  initialize: vi.fn(), prepareInterstitial: vi.fn(), showInterstitial: vi.fn(),
  prepareRewardVideoAd: vi.fn(),
  showRewardVideoAd: vi.fn(),
  addListener: vi.fn(async (event, fn) => { listeners[event] = fn; return { remove: vi.fn(() => { delete listeners[event] }) } }),
  // Default: consent not required (typical non-EEA user) and ads allowed.
  requestConsentInfo: vi.fn(() => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true })),
  showConsentForm: vi.fn(() => ({ status: 'OBTAINED', canRequestAds: true })),
})
vi.mock('@capacitor-community/admob', () => ({
  AdMob: admob,
  MaxAdContentRating: { General: 'General' },
  AdmobConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', REQUIRED: 'REQUIRED', OBTAINED: 'OBTAINED', UNKNOWN: 'UNKNOWN' },
  RewardAdPluginEvents: { Rewarded: 'rewarded', Dismissed: 'dismissed', FailedToShow: 'failedToShow' },
}))

vi.mock('../analytics', () => ({ track: vi.fn() }))

import { isAdFree, showInterstitial, adsAvailable, _resetAdSession, showRewardedVideo, rewardedAdUnit, TEST_REWARDED_ID, REWARDED_ID, TEST_REWARDED_ID_IOS, REWARDED_ID_IOS } from '../ads'

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

describe('showRewardedVideo', () => {
  // An interstitial test above leaves consent permanently refused; start from "allowed".
  beforeEach(() => {
    admob.requestConsentInfo.mockReturnValue({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true })
    admob.showConsentForm.mockReturnValue({ status: 'OBTAINED', canRequestAds: true })
  })
  const play = (events) => {
    admob.showRewardVideoAd.mockImplementation(async () => { for (const e of events) listeners[e]?.() })
  }

  it('is unavailable on web', async () => {
    mockNative.mockReturnValue(false)
    expect(await showRewardedVideo({ userId: 'u', grantId: 'g' })).toBe('unavailable')
    expect(admob.prepareRewardVideoAd).not.toHaveBeenCalled()
  })

  it('sends the grant and user to Google for server-side verification', async () => {
    mockNative.mockReturnValue(true)
    play(['rewarded', 'dismissed'])
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('rewarded')
    expect(admob.prepareRewardVideoAd).toHaveBeenCalledWith({ ...rewardedAdUnit(), ssv: { userId: 'u1', customData: 'g1' } })
    expect(Object.keys(listeners)).toEqual([]) // listeners removed afterwards
  })

  it('reports a video closed before the reward as dismissed', async () => {
    mockNative.mockReturnValue(true)
    play(['dismissed'])
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('dismissed')
  })

  it('reports a failed show as unavailable', async () => {
    mockNative.mockReturnValue(true)
    play(['failedToShow'])
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('unavailable')
    admob.showRewardVideoAd.mockRejectedValueOnce(new Error('not prepared'))
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('unavailable')
  })

  it('gives up instead of hanging when the ad listeners cannot be registered', async () => {
    mockNative.mockReturnValue(true)
    admob.addListener.mockRejectedValueOnce(new Error('bridge down'))
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('unavailable')
    expect(admob.showRewardVideoAd).not.toHaveBeenCalled()
  })

  it('shows nothing when consent forbids ads', async () => {
    mockNative.mockReturnValue(true)
    admob.requestConsentInfo.mockReturnValueOnce({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false })
    admob.showConsentForm.mockReturnValueOnce({ status: 'OBTAINED', canRequestAds: false })
    expect(await showRewardedVideo({ userId: 'u1', grantId: 'g1' })).toBe('unavailable')
    expect(admob.prepareRewardVideoAd).not.toHaveBeenCalled()
  })

  it('plays the Google test unit in dev builds and the real unit in release builds', () => {
    expect(rewardedAdUnit(true)).toEqual({ adId: TEST_REWARDED_ID, isTesting: true })
    expect(rewardedAdUnit(false)).toEqual({ adId: 'ca-app-pub-2677287550445019/3600927444', isTesting: false })
    expect(REWARDED_ID).toBe('ca-app-pub-2677287550445019/3600927444')
  })

  it('uses the iOS units on iPhone: Google iOS test unit in dev, the real iOS unit in release', () => {
    expect(rewardedAdUnit(true, 'ios')).toEqual({ adId: 'ca-app-pub-3940256099942544/1712485313', isTesting: true })
    expect(rewardedAdUnit(false, 'ios')).toEqual({ adId: 'ca-app-pub-2677287550445019/4791412117', isTesting: false })
    expect(TEST_REWARDED_ID_IOS).toBe('ca-app-pub-3940256099942544/1712485313')
    expect(REWARDED_ID_IOS).toBe('ca-app-pub-2677287550445019/4791412117')
  })

  it('asks the platform when none is passed, so an iPhone plays the iOS unit', () => {
    mockPlatform.mockReturnValueOnce('ios')
    expect(rewardedAdUnit(false)).toEqual({ adId: REWARDED_ID_IOS, isTesting: false })
    expect(rewardedAdUnit(false)).toEqual({ adId: REWARDED_ID, isTesting: false })
  })
})
