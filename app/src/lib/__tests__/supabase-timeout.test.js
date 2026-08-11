import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Regression guard for the overnight "Taking longer than expected" hang.
//
// auth-js calls fetch() with no AbortSignal of its own, and getSession() awaits
// initializePromise -> _recoverAndRefresh() -> the token refresh POST. A socket
// that never settles therefore wedges every getSession() caller forever, which
// pins AuthProvider's `loading` true and strands the user on the watchdog screen.
// lib/supabase.js supplies a timeout-bearing fetch to bound that; these tests
// assert the wrapper actually aborts and actually reaches createClient.

const createClient = vi.fn(() => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_KEY', 'test-key')

async function loadWrappedFetch() {
  vi.resetModules()
  createClient.mockClear()
  await import('../supabase.js')
  return createClient.mock.calls[0][2].global.fetch
}

describe('supabase client fetch timeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('passes a custom fetch through to createClient', async () => {
    const wrapped = await loadWrappedFetch()
    expect(typeof wrapped).toBe('function')
  })

  it('attaches an abort signal even when the caller supplies none', async () => {
    let seen
    vi.stubGlobal('fetch', (_input, init) => { seen = init.signal; return Promise.resolve('ok') })

    const wrapped = await loadWrappedFetch()
    await wrapped('https://example.supabase.co/auth/v1/token', {})

    expect(seen).toBeInstanceOf(AbortSignal)
    expect(seen.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts a hung request after 12s without AbortSignal.timeout/any support', async () => {
    // Old Android WebViews have AbortController but lack these newer static
    // helpers. The previous implementation returned bare fetch in this case.
    vi.stubGlobal('AbortSignal', undefined)
    let seen
    vi.stubGlobal('fetch', (_input, init) => new Promise((_resolve, reject) => {
      seen = init.signal
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
    }))

    const wrapped = await loadWrappedFetch()
    const settled = wrapped('https://example.supabase.co/rest/v1/profiles', {})
      .then(() => 'resolved', (error) => error)
    await vi.advanceTimersByTimeAsync(12000)

    expect(seen.aborted).toBe(true)
    await expect(settled).resolves.toEqual(expect.objectContaining({ name: 'TimeoutError' }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves a settling request alone', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve('ok'))
    const wrapped = await loadWrappedFetch()
    await expect(wrapped('https://example.supabase.co/rest/v1/profiles', {})).resolves.toBe('ok')
  })

  it('still honours a caller-supplied signal', async () => {
    vi.stubGlobal('fetch', (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
    }))

    const wrapped = await loadWrappedFetch()
    const controller = new AbortController()
    const settled = wrapped('https://example.supabase.co/rest/v1/profiles', { signal: controller.signal })
      .then(() => 'resolved', (e) => e)

    controller.abort(new Error('caller aborted'))
    await expect(settled).resolves.toEqual(expect.objectContaining({ message: 'caller aborted' }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still bounds the caller when AbortController is unavailable', async () => {
    vi.stubGlobal('AbortController', undefined)
    vi.stubGlobal('fetch', () => new Promise(() => {}))

    const wrapped = await loadWrappedFetch()
    const settled = wrapped('https://example.supabase.co/rest/v1/profiles', {})
      .then(() => 'resolved', (error) => error)
    await vi.advanceTimersByTimeAsync(12000)

    await expect(settled).resolves.toEqual(expect.objectContaining({ name: 'TimeoutError' }))
    expect(vi.getTimerCount()).toBe(0)
  })
})
