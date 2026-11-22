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
  register: vi.fn(),
  addListener: vi.fn((event, cb) => { listeners[event] = cb; return Promise.resolve({ remove: vi.fn() }) }),
}
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }))

const localSchedule = vi.fn().mockResolvedValue(undefined)
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { schedule: localSchedule } }))

import { registerFCM, unregisterFCM, releaseFCMToken, checkFCMPermission } from '../pushAndroid'

// saveToken() runs unawaited off the 'registration' listener callback - flush
// past its internal awaits (delete-then-upsert) before asserting on it.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// Like the real plugin: register() resolves at once and the token follows as a
// separate 'registration' event (on iOS, seconds later).
const autoToken = () => {
  push.register.mockImplementation(() => {
    setTimeout(() => listeners.registration?.({ value: 'token-auto' }), 0)
    return Promise.resolve()
  })
}

beforeEach(() => {
  autoToken()
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

  it('fails registration (so the toggle never flips on) when the token cannot be saved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    upsert.mockResolvedValueOnce({ error: { message: 'RLS violation' } })
    await expect(registerFCM('u1')).rejects.toThrow('Could not save this device for push')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('save FCM token'), 'RLS violation')
    warn.mockRestore()
  })

  it('only resolves once the token is saved, not when register() returns (iOS race)', async () => {
    push.register.mockImplementation(() => Promise.resolve()) // token arrives later
    let done = false
    const p = registerFCM('u1').then(() => { done = true })
    await flush()
    expect(push.register).toHaveBeenCalled()
    expect(done).toBe(false)
    expect(upsert).not.toHaveBeenCalled()
    listeners.registration({ value: 'late-ios-token' })
    await p
    expect(done).toBe(true)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'late-ios-token' }), { onConflict: 'user_id,endpoint' },
    )
  })

  it('rejects with a save error when the upsert itself throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    upsert.mockRejectedValueOnce(new Error('network down'))
    await expect(registerFCM('u1')).rejects.toThrow('Could not save this device for push')
    warn.mockRestore()
  })

  it('shares one registration between overlapping calls for the same account', async () => {
    const a = registerFCM('u1')
    const b = registerFCM('u1')
    expect(b).toBe(a)
    await a
    expect(push.register).toHaveBeenCalledTimes(1)
  })

  it('rejects when the platform reports a registration error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    push.register.mockImplementation(() => {
      setTimeout(() => listeners.registrationError({ error: 'no APNs token' }), 0)
      return Promise.resolve()
    })
    await expect(registerFCM('u1')).rejects.toThrow('Push registration failed')
    expect(upsert).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('gives up after 20 s without a token instead of hanging the toggle', async () => {
    vi.useFakeTimers()
    try {
      push.register.mockImplementation(() => Promise.resolve())
      const p = registerFCM('u1')
      const assertion = expect(p).rejects.toThrow('Timed out waiting for the push token')
      await vi.advanceTimersByTimeAsync(20000)
      await assertion
      // a late token afterwards is still saved (rotation path), without throwing
      listeners.registration({ value: 'very-late-token' })
      await vi.runAllTimersAsync()
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'very-late-token' }), { onConflict: 'user_id,endpoint' },
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('is a no-op on web', async () => {
    mockNative.mockReturnValue(false); mockPlatform.mockReturnValue('web')
    await registerFCM('u1')
    expect(push.register).not.toHaveBeenCalled()
  })

  it('on iOS registers without an Android channel and saves the token as ios', async () => {
    mockPlatform.mockReturnValue('ios')
    await registerFCM('u1')
    expect(push.createChannel).not.toHaveBeenCalled()
    expect(push.register).toHaveBeenCalled()
    listeners.registration({ value: 'fcm-ios-token' })
    await flush()
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', endpoint: 'fcm-ios-token', platform: 'ios' }, { onConflict: 'user_id,endpoint' },
    )
  })

  it('on iOS does not re-raise a foreground push (iOS shows it itself)', async () => {
    mockPlatform.mockReturnValue('ios')
    await registerFCM('u1')
    await listeners.pushNotificationReceived({ title: 'Reminder', body: 'Time for sandhya' })
    await flush()
    expect(localSchedule).not.toHaveBeenCalled()
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

  it("on iOS deletes only this platform's rows", async () => {
    mockPlatform.mockReturnValue('ios')
    await unregisterFCM('u1')
    expect(match).toHaveBeenCalledWith({ user_id: 'u1', platform: 'ios' })
  })

  it('is a no-op on web', async () => {
    mockNative.mockReturnValue(false); mockPlatform.mockReturnValue('web')
    await unregisterFCM('u1')
    expect(match).not.toHaveBeenCalled()
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

  it('returns the current status on iOS without prompting', async () => {
    mockPlatform.mockReturnValue('ios')
    push.checkPermissions.mockResolvedValueOnce({ receive: 'prompt' })
    await expect(checkFCMPermission()).resolves.toBe('prompt')
    expect(push.requestPermissions).not.toHaveBeenCalled()
  })

  it('reports granted on web so it never self-heals into FCM', async () => {
    mockNative.mockReturnValue(false); mockPlatform.mockReturnValue('web')
    await expect(checkFCMPermission()).resolves.toBe('granted')
    expect(push.checkPermissions).not.toHaveBeenCalled()
  })
})
