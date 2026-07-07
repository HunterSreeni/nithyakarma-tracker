import { describe, it, expect, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

import { shareText, shareUrl } from '../share'

describe('shareText', () => {
  it('builds the WhatsApp status text with referral link', () => {
    const text = shareText({
      streak: 48, practiceName: 'Hanuman Chalisa',
      displayName: 'Sreeni H', tier: 'Tapasvi', referralCode: 'abc123',
    })
    expect(text).toContain('48 day streak')
    expect(text).toContain('Hanuman Chalisa')
    expect(text).toContain('Sreeni H (Tapasvi)')
    expect(text).toContain('/r/abc123')
  })
})

describe('shareUrl', () => {
  it('builds the referral url from the origin', () => {
    expect(shareUrl('xyz')).toMatch(/\/r\/xyz$/)
  })
})
