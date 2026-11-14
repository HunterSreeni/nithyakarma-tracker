import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ native: true, store: {}, session: null, capture: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: h.store[key] ?? null }),
    set: async ({ key, value }) => { h.store[key] = value },
  },
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: h.session } }) } } }))
vi.mock('../../lib/posthog', () => ({ capture: (...a) => h.capture(...a) }))

import { trackFirstOpen } from '../firstOpen'

beforeEach(() => { vi.clearAllMocks(); h.native = true; h.store = {}; h.session = null })

describe('trackFirstOpen', () => {
  it('sends app_first_open once per install with the install source', async () => {
    expect(await trackFirstOpen({ install_utm_source: 'ig' })).toBe(true)
    expect(h.capture).toHaveBeenCalledWith('app_first_open', { install_utm_source: 'ig', existing_user: false })
    expect(await trackFirstOpen({ install_utm_source: 'ig' })).toBe(false)
    expect(h.capture).toHaveBeenCalledTimes(1)
  })

  it('marks an app update on a signed-in device as existing_user', async () => {
    h.session = { user: { id: 'u1' } }
    await trackFirstOpen()
    expect(h.capture).toHaveBeenCalledWith('app_first_open', { existing_user: true })
  })

  it('never fires on the web', async () => {
    h.native = false
    expect(await trackFirstOpen()).toBe(false)
    expect(h.capture).not.toHaveBeenCalled()
  })
})
