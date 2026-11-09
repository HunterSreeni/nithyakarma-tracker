import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn().mockReturnValue(true)
const mockPlatform = vi.fn().mockReturnValue('android')
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => mockPlatform() },
}))

const upsert = vi.fn().mockResolvedValue({ error: null })
const match = vi.fn().mockResolvedValue({ error: null })
const neq = vi.fn().mockResolvedValue({ error: null })
const eq = vi.fn(() => ({ neq }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ upsert, delete: () => ({ match, eq }) })) },
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

const localSchedule = vi.fn().mockResolvedValue(undefined)
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { schedule: localSchedule } }))

import { registerFCM, unregisterFCM, releaseFCMToken } from '../pushAndroid'

// saveToken() runs unawaited off the 'registration' listener callback - flush
// past its internal awaits (delete-then-upsert) before asserting on it.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  upsert.mockClear(); match.mockClear(); eq.mockClear(); neq.mockClear()
  push.createChannel.mockClear(); push.register.mockClear(); push.addListener.mockClear()
  localSchedule.mockClear()
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
    await flush()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', endpoint: 'token-A', platform: 'android' }),
      { onConflict: 'user_id,endpoint' },
    )
    // FCM rotates the token later - no new register() call, just the event.
    listeners.registration({ value: 'token-B' })
    await flush()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'token-B' }), { onConflict: 'user_id,endpoint' },
    )
  })

  it('does not attempt a client-side cross-account delete (RLS made it a silent no-op)', async () => {
    await registerFCM('u1')
    listeners.registration({ value: 'shared-device-token' })
    await flush()
    // Ownership transfer is the push_subscriptions_single_owner trigger's job.
    expect(eq).not.toHaveBeenCalled()
    expect(neq).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', endpoint: 'shared-device-token' }), { onConflict: 'user_id,endpoint' },
    )
  })

  it('logs instead of throwing when the token upsert fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    upsert.mockResolvedValueOnce({ error: { message: 'RLS violation' } })
    await registerFCM('u1')
    listeners.registration({ value: 'token-A' })
    await flush()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('save FCM token'), 'RLS violation')
    warn.mockRestore()
  })

  it('is a no-op off-Android', async () => {
    mockPlatform.mockReturnValue('ios')
    await registerFCM('u1')
    // register not called this run (createChannel from earlier tests is cleared per-file scope)
    expect(push.register).not.toHaveBeenCalled()
  })

  it('raises a local notification for a push received while foregrounded', async () => {
    await registerFCM('u1')
    await listeners.pushNotificationReceived({ title: 'Reminder', body: 'Time for sandhya' })
    await flush()
    expect(localSchedule).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ title: 'Reminder', body: 'Time for sandhya' })],
    })
  })
})

describe('unregisterFCM', () => {
  it('deletes the subscription and stops persisting rotated tokens', async () => {
    await registerFCM('u1')
    await unregisterFCM('u1')
    expect(match).toHaveBeenCalledWith({ user_id: 'u1', platform: 'android' })
    upsert.mockClear()
    // a rotation arriving after disable must not re-create a subscription
    listeners.registration({ value: 'token-C' })
    await flush()
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('releaseFCMToken (sign-out)', () => {
  it("deletes only this device's row and stops saving rotated tokens", async () => {
    await registerFCM('u1')
    listeners.registration({ value: 'token-D' })
    await flush()
    await releaseFCMToken()
    expect(match).toHaveBeenCalledWith({ user_id: 'u1', endpoint: 'token-D' })
    upsert.mockClear()
    listeners.registration({ value: 'token-E' })
    await flush()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('is a no-op when this device never saved a token', async () => {
    await releaseFCMToken()
    expect(match).not.toHaveBeenCalled()
  })
})
