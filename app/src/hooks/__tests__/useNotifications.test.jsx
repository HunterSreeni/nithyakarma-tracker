import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative(), getPlatform: () => 'web' },
}))

const upsertPref = vi.fn().mockResolvedValue({ error: null })
const deleteSub = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'notification_preferences') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false } }) }) }),
          upsert: upsertPref,
        }
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: () => ({ match: deleteSub }),
      }
    }),
  },
}))
vi.mock('../../utils/notifications', () => ({
  scheduleAllReminders: vi.fn().mockResolvedValue(true),
  cancelAllReminders: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../utils/pushAndroid', () => ({
  registerFCM: vi.fn().mockResolvedValue('token'),
  unregisterFCM: vi.fn().mockResolvedValue(undefined),
}))

import { useNotifications } from '../useNotifications'

const user = { id: 'u1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
})

describe('useNotifications (web)', () => {
  it('reports unsupported when the browser lacks push APIs', async () => {
    // jsdom has no PushManager/Notification -> unsupported on web
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.supported).toBe(false)
  })

  it('refuses to enable and explains when push is unsupported', async () => {
    const { result } = renderHook(() => useNotifications(user))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/not supported/)
    expect(upsertPref).not.toHaveBeenCalled()
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
})
