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

  // AbortSignal.timeout is driven by a platform timer, not setTimeout, so fake
  // timers cannot advance it and asserting the real 12s elapse would mean a 12s
  // test. Assert the wiring instead: an unsignalled call must still reach fetch
  // carrying a live abort signal, which is precisely what auth-js never supplies
  // on its own.
  it('attaches an abort signal even when the caller supplies none', async () => {
    let seen
    vi.stubGlobal('fetch', (_input, init) => { seen = init.signal; return Promise.resolve('ok') })

    const wrapped = await loadWrappedFetch()
    await wrapped('https://example.supabase.co/auth/v1/token', {})

    expect(seen).toBeInstanceOf(AbortSignal)
    expect(seen.aborted).toBe(false)
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
  })
})
