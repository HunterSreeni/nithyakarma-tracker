import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsert = vi.fn().mockResolvedValue({ error: null })
const match = vi.fn().mockResolvedValue({ error: null })
const neq = vi.fn().mockResolvedValue({ error: null })
const eq = vi.fn(() => ({ neq }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ upsert, delete: () => ({ match, eq }) })) },
}))

// Valid base64 (no url-unsafe chars needed) so urlBase64ToUint8Array doesn't throw.
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'QUJDRA')

const { isPushSupported, setupWebPush, deleteWebPushSubscription } = await import('../webPush')

function fakeRegistration({ existingSubscription = null, newSubscription } = {}) {
  return {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(existingSubscription),
      subscribe: vi.fn().mockResolvedValue(newSubscription ?? {
        toJSON: () => ({ endpoint: 'https://push.example/ep1', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
      }),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  window.PushManager = window.PushManager ?? function () {}
  window.Notification = window.Notification ?? { permission: 'granted' }
})

describe('isPushSupported', () => {
  it('is false when a required browser API is missing', () => {
    const original = navigator.serviceWorker
    delete navigator.serviceWorker
    expect(isPushSupported()).toBe(false)
    navigator.serviceWorker = original
  })
})

describe('setupWebPush', () => {
  it('creates a subscription and reclaims any row left by a different account before upserting', async () => {
    navigator.serviceWorker = { ready: Promise.resolve(fakeRegistration()) }
    await setupWebPush('u1')
    // The unique constraint is (user_id, endpoint), not endpoint alone - a
    // stale row from a previous account on this device/browser must be
    // cleared first or the upsert would collide under RLS.
    expect(eq).toHaveBeenCalledWith('endpoint', 'https://push.example/ep1')
    expect(neq).toHaveBeenCalledWith('user_id', 'u1')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1', endpoint: 'https://push.example/ep1',
        p256dh: 'p256dh-key', auth_key: 'auth-key', platform: 'web',
      }),
      { onConflict: 'user_id,endpoint' },
    )
  })

  it('reuses an existing browser subscription instead of creating a new one', async () => {
    const reg = fakeRegistration({
      existingSubscription: { toJSON: () => ({ endpoint: 'https://push.example/existing', keys: { p256dh: 'p', auth: 'a' } }) },
    })
    navigator.serviceWorker = { ready: Promise.resolve(reg) }
    await setupWebPush('u1')
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('throws instead of swallowing when the subscription upsert fails', async () => {
    navigator.serviceWorker = { ready: Promise.resolve(fakeRegistration()) }
    upsert.mockResolvedValueOnce({ error: { message: 'RLS violation' } })
    await expect(setupWebPush('u1')).rejects.toBeTruthy()
  })

  it('is a silent no-op when the browser does not support push', async () => {
    delete navigator.serviceWorker
    await expect(setupWebPush('u1')).resolves.toBeUndefined()
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('setupWebPush without a configured VAPID key', () => {
  it('throws instead of silently no-opping (this was the missing-Netlify-env failure mode)', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    vi.resetModules()
    const { setupWebPush: setupWebPushNoKey } = await import('../webPush')
    navigator.serviceWorker = { ready: Promise.resolve(fakeRegistration()) }
    await expect(setupWebPushNoKey('u1')).rejects.toThrow(/VAPID/)
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'QUJDRA')
    vi.resetModules()
  })
})

describe('deleteWebPushSubscription', () => {
  it('unsubscribes and deletes the stored row', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    navigator.serviceWorker = {
      ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) } }),
    }
    await deleteWebPushSubscription('u1')
    expect(unsubscribe).toHaveBeenCalled()
    expect(match).toHaveBeenCalledWith({ user_id: 'u1', platform: 'web' })
  })

  it('is best-effort and does not throw if the browser call fails', async () => {
    navigator.serviceWorker = { ready: Promise.reject(new Error('boom')) }
    await expect(deleteWebPushSubscription('u1')).resolves.toBeUndefined()
  })
})
