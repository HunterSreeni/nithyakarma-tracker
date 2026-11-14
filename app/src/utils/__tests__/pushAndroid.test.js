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

import { registerFCM, unregisterFCM, releaseFCMToken, checkFCMPermission } from '../pushAndroid'

// saveToken() runs unawaited off the 'registration' listener callback - flush
// past its internal awaits (delete-then-upsert) before asserting on it.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  upsert.mockClear(); match.mockClear(); eq.mockClear(); neq.mockClear()
  push.createChannel.mockClear(); push.register.mockClear(); push.addListener.mockClear()
  push.checkPermissions.mockClear(); push.requestPermissions.mockClear()
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

describe('registerFCM - permissions and listeners', () => {
  it('requests permission when not yet granted, then registers', async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: 'prompt' })
    push.requestPermissions.mockResolvedValueOnce({ receive: 'granted' })
    await registerFCM('u1')
    expect(push.requestPermissions).toHaveBeenCalledTimes(1)
    expect(push.register).toHaveBeenCalled()
  })

  it('throws and never registers when the user denies permission', async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: 'prompt' })
    push.requestPermissions.mockResolvedValueOnce({ receive: 'denied' })
    await expect(registerFCM('u1')).rejects.toThrow('Notification permission denied')
    expect(push.register).not.toHaveBeenCalled()
  })

  it('still registers when the channel cannot be created (older Android)', async () => {
    push.createChannel.mockRejectedValueOnce(new Error('unsupported'))
    await registerFCM('u1')
    expect(push.register).toHaveBeenCalled()
  })

  it('creates the channel with max importance and public visibility', async () => {
    await registerFCM('u1')
    expect(push.createChannel).toHaveBeenCalledWith({
      id: 'reminders', name: 'Reminders', description: 'Daily anushtanam reminders', importance: 5, visibility: 1,
    })
  })

  it('logs a registration error instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    listeners.registrationError({ error: 'SERVICE_NOT_AVAILABLE' })
    expect(warn).toHaveBeenCalledWith('[push] FCM registration error', 'SERVICE_NOT_AVAILABLE')
    warn.mockRestore()
  })

  it('opens the URL from a tapped push, and ignores a push without one', () => {
    const original = window.location
    delete window.location
    window.location = { href: 'https://app.test/' }
    listeners.pushNotificationActionPerformed({ notification: { data: { url: 'https://app.test/today' } } })
    expect(window.location.href).toBe('https://app.test/today')
    listeners.pushNotificationActionPerformed({ notification: { data: {} } })
    listeners.pushNotificationActionPerformed(undefined)
    expect(window.location.href).toBe('https://app.test/today')
    window.location = original
  })

  it('uses fallback title/body for a foreground push without them', async () => {
    await listeners.pushNotificationReceived({})
    expect(localSchedule).toHaveBeenCalledWith({
      notifications: [{ id: 600, title: 'Nithyakarma', body: '' }],
    })
  })

  it('never throws from the foreground handler when scheduling fails', async () => {
    localSchedule.mockRejectedValueOnce(new Error('boom'))
    await expect(listeners.pushNotificationReceived({ title: 't' })).resolves.toBeUndefined()
  })
})

describe('checkFCMPermission', () => {
  it('returns the current status on Android without prompting', async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: 'denied' })
    await expect(checkFCMPermission()).resolves.toBe('denied')
    expect(push.requestPermissions).not.toHaveBeenCalled()
  })

  it('reports granted off-Android so web never self-heals into FCM', async () => {
    mockPlatform.mockReturnValue('ios')
    await expect(checkFCMPermission()).resolves.toBe('granted')
    mockNative.mockReturnValue(false)
    await expect(checkFCMPermission()).resolves.toBe('granted')
    expect(push.checkPermissions).not.toHaveBeenCalled()
  })
})
