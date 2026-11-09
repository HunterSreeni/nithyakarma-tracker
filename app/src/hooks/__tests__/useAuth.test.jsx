import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

let authCb, urlOpenCb
const mockAddListener = vi.fn((event, cb) => {
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
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
      onAuthStateChange: (cb) => {
        authCb = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }), order: () => Promise.resolve({ data: [] }) }) }) })),
  },
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
const cancelAllReminders = vi.fn().mockResolvedValue(undefined)
const releaseFCMToken = vi.fn().mockResolvedValue(undefined)
const releaseWebPushEndpoint = vi.fn().mockResolvedValue(undefined)
vi.mock('../../utils/notifications', () => ({ cancelAllReminders: (...a) => cancelAllReminders(...a) }))
vi.mock('../../utils/pushAndroid', () => ({ releaseFCMToken: (...a) => releaseFCMToken(...a) }))
vi.mock('../../utils/webPush', () => ({ releaseWebPushEndpoint: (...a) => releaseWebPushEndpoint(...a) }))

import { AuthProvider, useAuth } from '../useAuth'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
  authCb = undefined
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
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u1', display_name: 'Fresh' } }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
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

  // Shared-device duplicate-push bug: the previous account's device row and
  // local reminders must be released while the session is still valid (RLS).
  it("signOut() releases this device's push row and local reminders before ending the session", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const order = []
    releaseWebPushEndpoint.mockImplementation(async () => { order.push('release') })
    signOut.mockImplementation(async () => { order.push('signOut'); return { error: null } })
    await result.current.signOut()
    expect(cancelAllReminders).toHaveBeenCalled()
    expect(releaseFCMToken).toHaveBeenCalled()
    expect(releaseWebPushEndpoint).toHaveBeenCalledWith('u1')
    expect(order).toEqual(['release', 'signOut'])
  })

  it('signOut() still signs out when cleanup hangs (offline) or fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))
      releaseWebPushEndpoint.mockReturnValue(new Promise(() => {}))
      releaseFCMToken.mockRejectedValue(new Error('offline'))
      const done = result.current.signOut()
      await vi.advanceTimersByTimeAsync(3100)
      await done
      expect(signOut).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// F1 (state machine audit): profileStatus separates 'not fetched yet' from
// 'no profile', so Gate only shows Onboarding when the server said absent.
describe('profileStatus', () => {
  const SESSION = { data: { session: { user: { id: 'u1', email: 'a@b.com' } } } }
  const tables = (profileRead) => (t) => t === 'profiles'
    ? { select: () => ({ eq: () => ({ maybeSingle: profileRead }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
    : { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }

  it("is 'absent' only after the server returns no profile", async () => {
    getSession.mockResolvedValue(SESSION)
    supabase.from.mockImplementation(tables(() => Promise.resolve({ data: null, error: null })))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profileStatus).toBe('absent'))
  })

  it("is 'present' once a profile loads", async () => {
    getSession.mockResolvedValue(SESSION)
    supabase.from.mockImplementation(tables(() => Promise.resolve({ data: { id: 'u1', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, error: null })))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profileStatus).toBe('present'))
  })

  it("is 'error', not 'absent', when the fetch fails with no cached profile", async () => {
    getSession.mockResolvedValue(SESSION)
    supabase.from.mockImplementation(tables(() => Promise.resolve({ data: null, error: { message: 'network down' } })))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profileStatus).toBe('error'))
    expect(result.current.profile).toBe(null)
  })

  it("keeps a cached profile 'present' when a background refresh fails", async () => {
    localStorage.setItem('nk_profile_cache_v1', JSON.stringify({ userId: 'u1', email: 'a@b.com', profile: { id: 'u1' }, familyMembers: [] }))
    getSession.mockResolvedValue(SESSION)
    supabase.from.mockImplementation(tables(() => Promise.resolve({ data: null, error: { message: 'network down' } })))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.refresh()?.catch(() => {}) })
    expect(result.current.profileStatus).toBe('present')
  })

  it("resets to 'unknown' on sign-out", async () => {
    getSession.mockResolvedValue(SESSION)
    supabase.from.mockImplementation(tables(() => Promise.resolve({ data: null, error: null })))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profileStatus).toBe('absent'))
    act(() => { authCb('SIGNED_OUT', null) })
    expect(result.current.profileStatus).toBe('unknown')
  })
})

// F2 (state machine audit): onboarding and add-family-member are multi-step;
// a retry after a partial failure must be safe and Sandhya never silently lost.
describe('retry-safe onboarding and family add', () => {
  const SESSION = { data: { session: { user: { id: 'u1', email: 'a@b.com' } } } }
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
  function mockDb({ profileInsertError = null, existingProfile = { id: 'u1', timezone: TZ }, sandhyaInsertError = null } = {}) {
    const calls = { sandhyaInserts: [] }
    supabase.from.mockImplementation((t) => {
      if (t === 'profiles') return {
        insert: () => Promise.resolve({ error: profileInsertError }),
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existingProfile, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
      if (t === 'practices') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 1 }, error: null }) }) }) }
      if (t === 'user_practices') return { insert: (row) => { calls.sandhyaInserts.push(row); return Promise.resolve({ error: sandhyaInsertError }) } }
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }),
      }
    })
    return calls
  }
  const PROFILE = { displayName: 'A', gender: 'male', isMarried: false, panchangamTradition: 'tamil', referralCode: null }
  async function signedIn() {
    getSession.mockResolvedValue(SESSION)
    const hook = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook.result
  }

  it('a retry whose profile insert hits a duplicate finishes the remaining steps', async () => {
    const calls = mockDb({ profileInsertError: { code: '23505', message: 'duplicate key' } })
    const result = await signedIn()
    await act(async () => { await result.current.createProfile(PROFILE) })
    expect(calls.sandhyaInserts).toHaveLength(1)
  })

  it('still fails when the duplicate is not actually our profile', async () => {
    mockDb({ profileInsertError: { code: '23505', message: 'duplicate key' }, existingProfile: null })
    const result = await signedIn()
    await expect(result.current.createProfile(PROFILE)).rejects.toMatchObject({ code: '23505' })
  })

  it('surfaces a failed Sandhya insert instead of silently skipping it', async () => {
    mockDb({ sandhyaInsertError: { code: '08006', message: 'connection failure' } })
    const result = await signedIn()
    await expect(result.current.createProfile(PROFILE)).rejects.toMatchObject({ code: '08006' })
  })

  it('treats an already-present Sandhya row as done', async () => {
    mockDb({ sandhyaInsertError: { code: '23505', message: 'duplicate key' } })
    const result = await signedIn()
    await act(async () => { await result.current.createProfile(PROFILE) })
  })

  it('a family add whose Sandhya step fails keeps the child and reports a partial, user-facing error', async () => {
    mockDb({ sandhyaInsertError: { code: '08006', message: 'connection failure' } })
    const result = await signedIn()
    let caught
    await act(async () => {
      try { await result.current.addFamilyMember({ name: 'Arjun', gender: 'male', upanayanamDone: true, balaSabhaOptIn: true }) } catch (e) { caught = e }
    })
    expect(caught).toMatchObject({ partial: true, userFacing: true })
    expect(caught.message).toMatch(/Arjun was added/)
  })
})

// M1: the in-memory React Query cache must not outlive the account, and the
// Sabha board must refetch after anything that moves scores or visibility.
describe('query cache hygiene', () => {
  const LB = ['leaderboard', 'u1', 'week', 'global']

  it('signOut() wipes the in-memory query cache (shared device)', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    queryClient.setQueryData(LB, [{ subject_id: 'u1' }])
    await result.current.signOut()
    expect(queryClient.getQueryData(LB)).toBeUndefined()
  })

  it('a SIGNED_OUT auth event also wipes it', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    queryClient.setQueryData(LB, [{ subject_id: 'u1' }])
    authCb('SIGNED_OUT', null)
    expect(queryClient.getQueryData(LB)).toBeUndefined()
  })

  it('refresh() (called after every mark) marks the leaderboard stale', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    queryClient.setQueryData(LB, [{ subject_id: 'u1' }])
    await result.current.refresh()
    expect(queryClient.getQueryState(LB).isInvalidated).toBe(true)
  })
})

// profiles.timezone drives decay_stale_streaks' idea of "today" for this
// account and its children (migration 20260810120000), so it has to track the
// device rather than only being written when someone opens the notification
// toggle - most accounts never do.
describe('timezone follows the device', () => {
  // These stub Intl globally; clearAllMocks does not undo a spyOn, so restore
  // explicitly or every later test in the file inherits the fake zone.
  afterEach(() => { vi.restoreAllMocks() })

  const profileWithTz = (timezone) => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u1', display_name: 'X', timezone } }) }) }),
    update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
  })

  it('persists the device zone when the stored one is out of date', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const profiles = profileWithTz('Asia/Kolkata')
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Asia/Dubai' }) })
    supabase.from.mockImplementation((t) => t === 'profiles' ? profiles
      : { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(profiles.update).toHaveBeenCalledWith({ timezone: 'Asia/Dubai' }))
    // and surfaces optimistically, without waiting for the write to land
    expect(result.current.profile.timezone).toBe('Asia/Dubai')
  })

  it('does not write when the stored zone already matches', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    const profiles = profileWithTz('Asia/Dubai')
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Asia/Dubai' }) })
    supabase.from.mockImplementation((t) => t === 'profiles' ? profiles
      : { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(profiles.update).not.toHaveBeenCalled()
  })

  // The write is a background nicety; if it throws, the profile must still load.
  it('still loads the profile when the timezone write blows up', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Asia/Dubai' }) })
    supabase.from.mockImplementation((t) => t === 'profiles' ? {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u1', display_name: 'X', timezone: 'Asia/Kolkata' } }) }) }),
      update: () => { throw new Error('builder exploded') },
    } : { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile.display_name).toBe('X')
  })

})

describe('auth-state lock safety', () => {
  it('returns synchronously from TOKEN_REFRESHED instead of awaiting a database query', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCb).toBeTypeOf('function'))
    const returned = authCb('TOKEN_REFRESHED', { user: { id: 'u1', email: 'a@b.com' } })
    expect(returned).toBeUndefined()
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
