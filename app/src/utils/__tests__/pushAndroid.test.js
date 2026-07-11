import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn().mockReturnValue(true)
const mockPlatform = vi.fn().mockReturnValue('android')
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => mockPlatform() },
}))

const upsert = vi.fn().mockResolvedValue({ error: null })
const del = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ upsert, delete: () => ({ match: del }) })) },
}))

// Capture the listener callbacks the module registers so we can fire them.
const listeners = {}
const push = {
  checkPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
  requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
  createChannel: vi.fn().mockResolvedValue(undefined),
  register: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn((event, cb) => { listeners[event] = cb; return Promise.resolve({ remove: vi.fn() }) }),
}
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }))

import { registerFCM, unregisterFCM } from '../pushAndroid'

beforeEach(() => {
  upsert.mockClear(); del.mockClear()
  push.createChannel.mockClear(); push.register.mockClear(); push.addListener.mockClear()
  mockNative.mockReturnValue(true); mockPlatform.mockReturnValue('android')
})

describe('registerFCM', () => {
  it('creates the "reminders" channel the edge function targets', async () => {
    await registerFCM('u1')
    expect(push.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'reminders' }))
    expect(push.register).toHaveBeenCalled()
  })

  it('saves the token on first registration AND on later rotation', async () => {
    await registerFCM('u1')
    listeners.registration({ value: 'token-A' })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', endpoint: 'token-A', platform: 'android' }),
      { onConflict: 'endpoint' },
    )
    // FCM rotates the token later - no new register() call, just the event.
    listeners.registration({ value: 'token-B' })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'token-B' }), { onConflict: 'endpoint' },
    )
  })

  it('is a no-op off-Android', async () => {
    mockPlatform.mockReturnValue('ios')
    await registerFCM('u1')
    // register not called this run (createChannel from earlier tests is cleared per-file scope)
    expect(push.register).not.toHaveBeenCalled()
  })
})

describe('unregisterFCM', () => {
  it('deletes the subscription and stops persisting rotated tokens', async () => {
    await registerFCM('u1')
    await unregisterFCM('u1')
    expect(del).toHaveBeenCalledWith({ user_id: 'u1', platform: 'android' })
    upsert.mockClear()
    // a rotation arriving after disable must not re-create a subscription
    listeners.registration({ value: 'token-C' })
    expect(upsert).not.toHaveBeenCalled()
  })
})
