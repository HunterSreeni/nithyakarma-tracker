import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mockNative() } }))

const prefsGet = vi.fn()
const prefsSet = vi.fn().mockResolvedValue(undefined)
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: (...a) => prefsGet(...a), set: (...a) => prefsSet(...a) },
}))

const requestReview = vi.fn().mockResolvedValue(undefined)
vi.mock('@capacitor-community/in-app-review', () => ({
  InAppReview: { requestReview: (...a) => requestReview(...a) },
}))

import { isMilestone, maybeRequestReview } from '../review'

beforeEach(() => {
  vi.clearAllMocks()
  prefsGet.mockResolvedValue({ value: null })
})

describe('isMilestone', () => {
  it('true only at defined streak milestones', () => {
    expect(isMilestone(3)).toBe(true)
    expect(isMilestone(30)).toBe(true)
    expect(isMilestone(365)).toBe(true)
    expect(isMilestone(5)).toBe(false)
    expect(isMilestone(0)).toBe(false)
  })
})

describe('maybeRequestReview', () => {
  it('no-ops on web (native-only)', async () => {
    mockNative.mockReturnValue(false)
    expect(await maybeRequestReview()).toBe(false)
    expect(requestReview).not.toHaveBeenCalled()
  })

  it('requests a review on native when never prompted before', async () => {
    mockNative.mockReturnValue(true)
    prefsGet.mockResolvedValue({ value: null })
    expect(await maybeRequestReview()).toBe(true)
    expect(requestReview).toHaveBeenCalledTimes(1)
    expect(prefsSet).toHaveBeenCalled() // records the prompt time
  })

  it('is rate-limited: skips if prompted recently', async () => {
    mockNative.mockReturnValue(true)
    prefsGet.mockResolvedValue({ value: String(Date.now()) })
    expect(await maybeRequestReview()).toBe(false)
    expect(requestReview).not.toHaveBeenCalled()
  })

  it('prompts again once the rate-limit window has passed', async () => {
    mockNative.mockReturnValue(true)
    const longAgo = Date.now() - 60 * 86400000 // 60 days
    prefsGet.mockResolvedValue({ value: String(longAgo) })
    expect(await maybeRequestReview()).toBe(true)
    expect(requestReview).toHaveBeenCalledTimes(1)
  })

  it('never throws if the plugin fails', async () => {
    mockNative.mockReturnValue(true)
    requestReview.mockRejectedValueOnce(new Error('no play services'))
    await expect(maybeRequestReview()).resolves.toBe(false)
  })
})
