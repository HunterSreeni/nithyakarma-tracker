import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => 'web' },
}))

const mockSupported = vi.fn().mockReturnValue(true)
const setupWebPush = vi.fn().mockResolvedValue(undefined)
const deleteWebPushSubscription = vi.fn().mockResolvedValue(undefined)
const hasActiveSubscription = vi.fn().mockResolvedValue(true)
vi.mock('../../utils/webPush', () => ({
  isPushSupported: (...args) => mockSupported(...args),
  setupWebPush: (...args) => setupWebPush(...args),
  deleteWebPushSubscription: (...args) => deleteWebPushSubscription(...args),
  hasActiveSubscription: (...args) => hasActiveSubscription(...args),
}))

const checkFCMPermission = vi.fn().mockResolvedValue('granted')
vi.mock('../../utils/pushAndroid', () => ({
  registerFCM: vi.fn().mockResolvedValue('token'),
  unregisterFCM: vi.fn().mockResolvedValue(undefined),
  checkFCMPermission: (...args) => checkFCMPermission(...args),
}))

vi.mock('../../utils/notifications', () => ({
  scheduleAllReminders: vi.fn().mockResolvedValue(true),
  cancelAllReminders: vi.fn().mockResolvedValue(undefined),
}))

const h = vi.hoisted(() => ({ prefEnabled: false }))
const upsertPref = vi.fn().mockResolvedValue({ error: null })
const deleteSub = vi.fn().mockResolvedValue({ error: null })
const invokeFn = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'notification_preferences') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: h.prefEnabled } }) }) }),
          upsert: upsertPref,
        }
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: () => ({ match: deleteSub }),
      }
    }),
    functions: { invoke: (...args) => invokeFn(...args) },
  },
}))

import { useNotifications } from '../useNotifications'

const user = { id: 'u1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
  mockSupported.mockReturnValue(true)
  hasActiveSubscription.mockResolvedValue(true)
  checkFCMPermission.mockResolvedValue('granted')
  h.prefEnabled = false
  window.Notification = { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
})

describe('useNotifications (web)', () => {
  it('reports unsupported when the browser lacks push APIs', async () => {
    mockSupported.mockReturnValue(false)
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(false)
  })

  it('refuses to enable and explains when push is unsupported', async () => {
    mockSupported.mockReturnValue(false)
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/not supported/)
    expect(upsertPref).not.toHaveBeenCalled()
  })

  it('blocks enabling and explains when notification permission is denied, without touching the DB', async () => {
    window.Notification.permission = 'denied'
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/blocked/)
    expect(upsertPref).not.toHaveBeenCalled()
  })
})

describe('useNotifications (web) - self-heal on mount', () => {
  it('proactively shows blocked guidance when already enabled but permission was revoked', async () => {
    h.prefEnabled = true
    window.Notification.permission = 'denied'
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.error).toMatch(/blocked/))
  })

  it('silently re-subscribes when already enabled, permission is still granted, but the subscription was lost (cache cleared)', async () => {
    h.prefEnabled = true
    hasActiveSubscription.mockResolvedValue(false)
    renderHook(() => useNotifications(user))
    await waitFor(() => expect(setupWebPush).toHaveBeenCalledWith('u1'))
  })

  it('does not re-subscribe when a subscription is still active', async () => {
    h.prefEnabled = true
    hasActiveSubscription.mockResolvedValue(true)
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(setupWebPush).not.toHaveBeenCalled()
  })
})

describe('useNotifications (native)', () => {
  it('is supported on native and enables with local reminders + FCM', async () => {
    mockNative.mockReturnValue(true)
    const { scheduleAllReminders } = await import('../../utils/notifications')
    const { registerFCM } = await import('../../utils/pushAndroid')
    const { result } = renderHook(() => useNotifications(user, { includeSandhya: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(true)
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(true)
    expect(upsertPref).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', enabled: true, timezone: expect.any(String) }),
      { onConflict: 'user_id' },
    )
    expect(scheduleAllReminders).toHaveBeenCalledWith({ includeSandhya: true })
    expect(registerFCM).toHaveBeenCalledWith('u1')
  })

  it('disabling cancels local reminders and unregisters FCM', async () => {
    mockNative.mockReturnValue(true)
    const { cancelAllReminders } = await import('../../utils/notifications')
    const { unregisterFCM } = await import('../../utils/pushAndroid')
    const { result } = renderHook(() => useNotifications(user, { includeSandhya: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle()) // on
    await act(() => result.current.toggle()) // off
    expect(result.current.enabled).toBe(false)
    expect(cancelAllReminders).toHaveBeenCalled()
    expect(unregisterFCM).toHaveBeenCalledWith('u1')
    expect(upsertPref).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }), { onConflict: 'user_id' },
    )
  })

  it('rolls back when local scheduling is denied', async () => {
    mockNative.mockReturnValue(true)
    const { scheduleAllReminders } = await import('../../utils/notifications')
    scheduleAllReminders.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useNotifications(user, { includeSandhya: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/denied/)
  })

  it('does not persist enabled=true when FCM registration fails - the pref must wait for a confirmed subscription', async () => {
    mockNative.mockReturnValue(true)
    const { cancelAllReminders } = await import('../../utils/notifications')
    const { registerFCM } = await import('../../utils/pushAndroid')
    registerFCM.mockRejectedValueOnce(new Error('registration denied'))
    const { result } = renderHook(() => useNotifications(user, { includeSandhya: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/Could not register/)
    expect(cancelAllReminders).toHaveBeenCalled() // rolls back local scheduling too
    expect(upsertPref).not.toHaveBeenCalled() // pref never flipped on for an unconfirmed subscription
  })
})

describe('useNotifications (native) - self-heal on mount', () => {
  it('idempotently re-registers FCM when already enabled and permission is still granted', async () => {
    mockNative.mockReturnValue(true)
    h.prefEnabled = true
    const { registerFCM } = await import('../../utils/pushAndroid')
    renderHook(() => useNotifications(user))
    await waitFor(() => expect(registerFCM).toHaveBeenCalledWith('u1'))
  })

  it('shows Android-blocked guidance instead of a false-positive checked box when permission was revoked', async () => {
    mockNative.mockReturnValue(true)
    h.prefEnabled = true
    checkFCMPermission.mockResolvedValue('denied')
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.error).toMatch(/blocked/))
  })
})

describe('sendTestNotification', () => {
  it('reports how many devices received the test push', async () => {
    invokeFn.mockResolvedValue({ data: { sent: 1, total: 1, results: [{ platform: 'web', ok: true }] }, error: null })
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.sendTestNotification())
    expect(invokeFn).toHaveBeenCalledWith('send-test-notification')
    expect(result.current.testResult).toMatch(/Sent to 1 of 1/)
  })

  it('surfaces the "no subscription" error from the edge function', async () => {
    invokeFn.mockResolvedValue({ data: { error: 'No active notification subscription found. Enable notifications first.' }, error: null })
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.sendTestNotification())
    expect(result.current.error).toMatch(/No active notification subscription/)
  })

  it('shows a friendly error when the function call itself fails', async () => {
    invokeFn.mockRejectedValue(new Error('Failed to fetch'))
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.sendTestNotification())
    expect(result.current.error).not.toBe('')
  })
})
