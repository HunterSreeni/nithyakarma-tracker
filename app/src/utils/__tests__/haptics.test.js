import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

const haptics = { impact: vi.fn() }
vi.mock('@capacitor/haptics', () => ({ Haptics: haptics, ImpactStyle: { Medium: 'MEDIUM' } }))

import { celebrationHaptic } from '../haptics'

beforeEach(() => vi.clearAllMocks())

describe('celebrationHaptic', () => {
  it('is a no-op on web', async () => {
    mockNative.mockReturnValue(false)
    await celebrationHaptic()
    expect(haptics.impact).not.toHaveBeenCalled()
  })

  it('fires a medium impact on native', async () => {
    mockNative.mockReturnValue(true)
    await celebrationHaptic()
    expect(haptics.impact).toHaveBeenCalledWith({ style: 'MEDIUM' })
  })

  it('never throws if the haptics SDK fails', async () => {
    mockNative.mockReturnValue(true)
    haptics.impact.mockRejectedValueOnce(new Error('unsupported'))
    await expect(celebrationHaptic()).resolves.toBeUndefined()
  })
})
