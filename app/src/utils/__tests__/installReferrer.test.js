import { describe, it, expect, vi, beforeEach } from 'vitest'

const cap = vi.hoisted(() => ({ native: true, platform: 'android', getReferrer: vi.fn() }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => cap.native, getPlatform: () => cap.platform },
  registerPlugin: (name) => (name === 'InstallReferrer' ? { getReferrer: (...a) => cap.getReferrer(...a) } : null),
}))
const store = vi.hoisted(() => ({ data: {}, get: vi.fn(), set: vi.fn() }))
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: (...a) => store.get(...a), set: (...a) => store.set(...a) } }))

import { parseReferrer, getInstallAttribution } from '../installReferrer'

beforeEach(() => {
  vi.clearAllMocks()
  cap.native = true; cap.platform = 'android'
  store.data = {}
  store.get.mockImplementation(async ({ key }) => ({ value: store.data[key] ?? null }))
  store.set.mockImplementation(async ({ key, value }) => { store.data[key] = value })
})

describe('parseReferrer', () => {
  it('keeps only utm_* from the Play referrer string, prefixed install_', () => {
    expect(parseReferrer('utm_source=instagram&utm_medium=social&utm_campaign=ekadashi&gclid=zz&foo=bar'))
      .toEqual({ install_utm_source: 'instagram', install_utm_medium: 'social', install_utm_campaign: 'ekadashi' })
  })
  it('handles organic installs and junk', () => {
    expect(parseReferrer('utm_source=google-play&utm_medium=organic')).toEqual({ install_utm_source: 'google-play', install_utm_medium: 'organic' })
    expect(parseReferrer('')).toEqual({})
    expect(parseReferrer(undefined)).toEqual({})
    expect(parseReferrer('utm_source=')).toEqual({})
  })
  it('caps value length', () => {
    expect(parseReferrer(`utm_source=${'a'.repeat(300)}`).install_utm_source).toHaveLength(100)
  })
})

describe('getInstallAttribution', () => {
  it('asks Play once, stores the answer, and never asks again', async () => {
    cap.getReferrer.mockResolvedValue({ referrer: 'utm_source=site&utm_medium=website' })
    const first = await getInstallAttribution()
    expect(first).toEqual({ install_utm_source: 'site', install_utm_medium: 'website' })
    cap.getReferrer.mockResolvedValue({ referrer: 'utm_source=changed' })
    expect(await getInstallAttribution()).toEqual(first)
    expect(cap.getReferrer).toHaveBeenCalledTimes(1)
  })

  it('stores "unknown" when Play returns no utm tags', async () => {
    cap.getReferrer.mockResolvedValue({ referrer: 'gclid=1' })
    expect(await getInstallAttribution()).toEqual({ install_utm_source: 'unknown' })
    expect(store.set).toHaveBeenCalledTimes(1)
  })

  it('stores nothing on a transient failure, so the next launch retries', async () => {
    cap.getReferrer.mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE'))
    expect(await getInstallAttribution()).toEqual({})
    expect(store.set).not.toHaveBeenCalled()
    cap.getReferrer.mockResolvedValueOnce({ referrer: 'utm_source=ig' })
    expect(await getInstallAttribution()).toEqual({ install_utm_source: 'ig' })
  })

  it('is a no-op on web and iOS', async () => {
    cap.native = false
    expect(await getInstallAttribution()).toEqual({})
    cap.native = true; cap.platform = 'ios'
    expect(await getInstallAttribution()).toEqual({})
    expect(cap.getReferrer).not.toHaveBeenCalled()
    expect(store.get).not.toHaveBeenCalled()
  })
})

describe('getInstallAttribution - concurrency and timeout', () => {
  it('shares one Play lookup between concurrent callers', async () => {
    cap.getReferrer.mockResolvedValue({ referrer: 'utm_source=wa' })
    const [a, b] = await Promise.all([getInstallAttribution(), getInstallAttribution()])
    expect(a).toEqual({ install_utm_source: 'wa' })
    expect(b).toEqual(a)
    expect(cap.getReferrer).toHaveBeenCalledTimes(1)
  })

  it('gives up after 5 s without storing, so the next launch retries', async () => {
    vi.useFakeTimers()
    cap.getReferrer.mockReturnValue(new Promise(() => {}))
    const p = getInstallAttribution()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(p).resolves.toEqual({})
    expect(store.set).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
