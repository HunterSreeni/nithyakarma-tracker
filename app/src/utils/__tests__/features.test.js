import { describe, it, expect, vi, beforeEach } from 'vitest'

const platform = { value: 'web' }
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.value } }))

const load = async () => (await import('../features')).JADHAGAM_ENABLED

beforeEach(() => vi.resetModules())

describe('JADHAGAM_ENABLED', () => {
  it.each(['web', 'android'])('is on for %s', async (p) => {
    platform.value = p
    expect(await load()).toBe(true)
  })

  it('is off in the iPhone app', async () => {
    platform.value = 'ios'
    expect(await load()).toBe(false)
  })
})
