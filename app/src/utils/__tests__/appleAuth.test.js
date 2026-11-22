import { describe, it, expect, vi, beforeEach } from 'vitest'

const platform = vi.fn(() => 'ios')
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform() } }))

// Like Capacitor's real plugin proxy: reading an unknown method, including the
// "then" a Promise looks for when the plugin is returned from an async
// function, throws. Catches that bug class here instead of on a phone.
const signIn = vi.fn()
const plugin = new Proxy({ signIn }, {
  get: (t, k) => (k in t ? t[k] : k === 'then'
    ? () => { throw new Error('"AppleSignIn.then()" is not implemented on ios') }
    : undefined),
})
vi.mock('@capawesome/capacitor-apple-sign-in', () => ({
  AppleSignIn: plugin,
  SignInScope: { Email: 'EMAIL', FullName: 'FULL_NAME' },
}))

import {
  makeNonce, signInWithApple, revokeAppleBeforeDelete, appleSignInAvailable, hasAppleIdentity, AppleSignInCanceled,
} from '../appleAuth'

const sha256hex = async (s) => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))),
  (b) => b.toString(16).padStart(2, '0'),
).join('')

const canceled = () => Object.assign(new Error('Sign in was canceled.'), { code: 'SIGN_IN_CANCELED' })

function fakeSupabase({ signInError = null, existingName = null, invoke } = {}) {
  return {
    auth: {
      signInWithIdToken: vi.fn().mockResolvedValue({
        data: signInError ? null : { user: { id: 'u1', user_metadata: existingName ? { full_name: existingName } : {} } },
        error: signInError,
      }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    functions: { invoke: invoke ?? vi.fn().mockResolvedValue({ data: { revoked: true }, error: null }) },
  }
}

const appleUser = { id: 'u1', identities: [{ provider: 'apple', id: '001.abc.002' }] }

beforeEach(() => {
  vi.clearAllMocks()
  platform.mockReturnValue('ios')
  signIn.mockResolvedValue({
    authorizationCode: 'code-1', idToken: 'id-token-1', user: '001.abc.002',
    email: 'x@privaterelay.appleid.com', givenName: 'Sreeni', familyName: 'S',
  })
})

describe('appleSignInAvailable', () => {
  it('is iPhone only', () => {
    expect(appleSignInAvailable()).toBe(true)
    platform.mockReturnValue('android')
    expect(appleSignInAvailable()).toBe(false)
    platform.mockReturnValue('web')
    expect(appleSignInAvailable()).toBe(false)
  })
})

describe('makeNonce', () => {
  it('gives Apple the SHA-256 of a fresh random nonce', async () => {
    const a = await makeNonce()
    const b = await makeNonce()
    expect(a.raw).toMatch(/^[0-9a-f]{64}$/)
    expect(a.raw).not.toBe(b.raw)
    expect(a.hashed).toBe(await sha256hex(a.raw))
  })
})

describe('signInWithApple', () => {
  it('sends the hashed nonce to Apple and the raw nonce with the ID token to Supabase', async () => {
    const supabase = fakeSupabase()
    const res = await signInWithApple(supabase)
    expect(res.error).toBeNull()
    const sent = signIn.mock.calls[0][0]
    expect(sent.scopes).toEqual(['EMAIL', 'FULL_NAME'])
    const { provider, token, nonce } = supabase.auth.signInWithIdToken.mock.calls[0][0]
    expect(provider).toBe('apple')
    expect(token).toBe('id-token-1')
    expect(sent.nonce).toBe(await sha256hex(nonce))
  })

  it('keeps the name Apple shares on first sign-in for onboarding', async () => {
    const supabase = fakeSupabase()
    await signInWithApple(supabase)
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sreeni S' } })
  })

  it('leaves an existing name alone, and skips it when Apple sends none', async () => {
    const named = fakeSupabase({ existingName: 'Already Set' })
    await signInWithApple(named)
    expect(named.auth.updateUser).not.toHaveBeenCalled()

    signIn.mockResolvedValueOnce({ authorizationCode: 'c', idToken: 't', user: 'u', email: null, givenName: null, familyName: null })
    const later = fakeSupabase()
    await signInWithApple(later)
    expect(later.auth.updateUser).not.toHaveBeenCalled()
  })

  it('reports a closed Apple sheet as canceled, not an error, and never calls Supabase', async () => {
    signIn.mockRejectedValueOnce(canceled())
    const supabase = fakeSupabase()
    expect(await signInWithApple(supabase)).toEqual({ canceled: true })
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled()
  })

  it('passes other Apple and Supabase failures through as errors', async () => {
    signIn.mockRejectedValueOnce(new Error('1000'))
    expect((await signInWithApple(fakeSupabase())).error.message).toBe('1000')

    const bad = fakeSupabase({ signInError: new Error('invalid nonce') })
    const res = await signInWithApple(bad)
    expect(res.error.message).toBe('invalid nonce')
    expect(bad.auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('hasAppleIdentity', () => {
  it('looks for an apple identity on the user', () => {
    expect(hasAppleIdentity(appleUser)).toBe(true)
    expect(hasAppleIdentity({ identities: [{ provider: 'google' }] })).toBe(false)
    expect(hasAppleIdentity(null)).toBe(false)
  })
})

describe('revokeAppleBeforeDelete', () => {
  it('does nothing for accounts without Apple', async () => {
    const supabase = fakeSupabase()
    expect(await revokeAppleBeforeDelete(supabase, { identities: [{ provider: 'google' }] })).toBe('none')
    expect(signIn).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('gets a fresh Apple code and has the server revoke it', async () => {
    const supabase = fakeSupabase()
    expect(await revokeAppleBeforeDelete(supabase, appleUser)).toBe('revoked')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('apple-revoke', { body: { authorizationCode: 'code-1' } })
  })

  it('throws AppleSignInCanceled when the user closes Apple\'s sheet, so nothing is deleted', async () => {
    signIn.mockRejectedValueOnce(canceled())
    const supabase = fakeSupabase()
    await expect(revokeAppleBeforeDelete(supabase, appleUser)).rejects.toBeInstanceOf(AppleSignInCanceled)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('falls back to the manual Settings note when the server cannot revoke', async () => {
    const notRevoked = fakeSupabase({ invoke: vi.fn().mockResolvedValue({ data: { revoked: false, reason: 'revoke_failed' }, error: null }) })
    expect(await revokeAppleBeforeDelete(notRevoked, appleUser)).toBe('manual')
    const httpError = fakeSupabase({ invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('500') }) })
    expect(await revokeAppleBeforeDelete(httpError, appleUser)).toBe('manual')
    const thrown = fakeSupabase({ invoke: vi.fn().mockRejectedValue(new Error('offline')) })
    expect(await revokeAppleBeforeDelete(thrown, appleUser)).toBe('manual')
  })

  it('cannot ask Apple off the iPhone, so it goes straight to the manual note', async () => {
    platform.mockReturnValue('android')
    const supabase = fakeSupabase()
    expect(await revokeAppleBeforeDelete(supabase, appleUser)).toBe('manual')
    expect(signIn).not.toHaveBeenCalled()
  })
})
