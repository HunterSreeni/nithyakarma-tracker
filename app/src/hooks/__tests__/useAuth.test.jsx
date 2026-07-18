import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

let resumeCb, urlOpenCb
const mockAddListener = vi.fn((event, cb) => {
  if (event === 'resume') resumeCb = cb
  if (event === 'appUrlOpen') urlOpenCb = cb
  return Promise.resolve({ remove: vi.fn() })
})
vi.mock('@capacitor/app', () => ({ App: { addListener: (...args) => mockAddListener(...args) } }))

const getSession = vi.fn()
const setSession = vi.fn().mockResolvedValue({ data: {}, error: null })
const signInWithOAuth = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      setSession: (...a) => setSession(...a),
      signInWithOAuth: (...a) => signInWithOAuth(...a),
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
  urlOpenCb = undefined
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

describe('Google Sign-In', () => {
  it('redirects to the native deep-link scheme on native', async () => {
    mockNative.mockReturnValue(true)
    getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    result.current.signInGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'org.nithyakarma.app://auth-callback' },
    })
  })

  it('redirects to window.location.origin on web', async () => {
    mockNative.mockReturnValue(false)
    getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    result.current.signInGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('completes the session from the appUrlOpen redirect on native', async () => {
    mockNative.mockReturnValue(true)
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function)))
    urlOpenCb({ url: 'org.nithyakarma.app://auth-callback#access_token=tok123&refresh_token=ref456' })
    await waitFor(() => expect(setSession).toHaveBeenCalledWith({ access_token: 'tok123', refresh_token: 'ref456' }))
  })

  it('ignores appUrlOpen events unrelated to the OAuth redirect', async () => {
    mockNative.mockReturnValue(true)
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function)))
    urlOpenCb({ url: 'org.nithyakarma.app://some-other-path' })
    expect(setSession).not.toHaveBeenCalled()
  })
})
