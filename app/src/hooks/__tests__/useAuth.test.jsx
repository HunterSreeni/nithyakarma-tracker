import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

let resumeCb
const mockAddListener = vi.fn((event, cb) => {
  resumeCb = cb
  return Promise.resolve({ remove: vi.fn() })
})
vi.mock('@capacitor/app', () => ({ App: { addListener: (...args) => mockAddListener(...args) } }))

const getSession = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }), order: () => Promise.resolve({ data: [] }) }) }) })),
  },
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import { AuthProvider, useAuth } from '../useAuth'

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
  resumeCb = undefined
})

describe('useAuth loading', () => {
  it('resolves loading=false even when getSession rejects - this was the 24h-idle stuck-"Loading..." bug', async () => {
    getSession.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBe(null)
  })

  it('resolves loading=false on a normal signed-out session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})

describe('resume/foreground revalidation', () => {
  it('re-validates the session when a native app resumes from the background', async () => {
    mockNative.mockReturnValue(true)
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('resume', expect.any(Function)))
    getSession.mockClear()
    resumeCb()
    await waitFor(() => expect(getSession).toHaveBeenCalled())
  })

  it('re-validates the session when the web tab becomes visible again', async () => {
    mockNative.mockReturnValue(false)
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    getSession.mockClear()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(getSession).toHaveBeenCalled())
  })
})
