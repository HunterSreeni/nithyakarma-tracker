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
const signOut = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      setSession: (...a) => setSession(...a),
      signInWithOAuth: (...a) => signInWithOAuth(...a),
      signOut: (...a) => signOut(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }), order: () => Promise.resolve({ data: [] }) }) }) })),
  },
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import { AuthProvider, useAuth } from '../useAuth'
import { supabase } from '../../lib/supabase'

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
  resumeCb = undefined
  urlOpenCb = undefined
  localStorage.clear() // the profile cache is real localStorage, not mocked - don't leak between tests
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

  it('loads profile and family_members in parallel, not sequentially - stacking two capped requests one after another is what blew past the 15s stuck watchdog on a slow reconnect', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    let resolveProfile
    const profilePromise = new Promise((res) => { resolveProfile = res })
    const calls = []
    supabase.from.mockImplementation((table) => {
      calls.push(table)
      if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: () => profilePromise }) }) }
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }
    })
    renderHook(() => useAuth(), { wrapper })
    // family_members must already have been requested even though the
    // profiles request hasn't resolved yet - proves the two run in parallel.
    await waitFor(() => expect(calls).toEqual(expect.arrayContaining(['profiles', 'family_members'])))
    resolveProfile({ data: { id: 'u1' } })
  })
})

describe('profile cache (cold-restart instant resume)', () => {
  const CACHE_KEY = 'nk_profile_cache_v1'

  it('renders session/profile from the cache immediately, before getSession() ever resolves', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      userId: 'u1', email: 'a@b.com', profile: { id: 'u1', display_name: 'Cached User' }, familyMembers: [],
    }))
    getSession.mockReturnValue(new Promise(() => {})) // deliberately never resolves in this test
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.session.user.id).toBe('u1')
    expect(result.current.profile.display_name).toBe('Cached User')
  })

  it('writes profile + familyMembers to the cache once a fresh loadProfile resolves', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u1', display_name: 'Fresh' } }) }) }) }
      }
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }
    })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
      expect(cached?.profile?.display_name).toBe('Fresh')
    })
  })

  it('clears the cache when getSession() reports no session', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId: 'u1', email: 'a@b.com', profile: {}, familyMembers: [] }))
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toBe(null))
  })

  it('signOut() clears the cache immediately, without waiting on the network call to settle', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId: 'u1', email: 'a@b.com', profile: {}, familyMembers: [] }))
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    let resolveSignOut
    signOut.mockReturnValue(new Promise((res) => { resolveSignOut = res }))
    result.current.signOut()
    expect(localStorage.getItem(CACHE_KEY)).toBe(null)
    resolveSignOut({ error: null })
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
