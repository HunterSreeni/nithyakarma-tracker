import { Capacitor } from '@capacitor/core'

// Sign in with Apple, iPhone only (App Review 4.8: required because Google
// sign-in is offered). Android and web have no Apple button.
// AI-DEV NOTE: native only, through @capawesome/capacitor-apple-sign-in and
// supabase.auth.signInWithIdToken. No web OAuth flow, so no Services ID and no
// client secret that expires every 6 months. Supabase skips the captcha for the
// id_token grant, so this button does not wait for Turnstile.

export function appleSignInAvailable() {
  return Capacitor.getPlatform() === 'ios'
}

export class AppleSignInCanceled extends Error {
  constructor() {
    super('Sign in with Apple was canceled')
    this.name = 'AppleSignInCanceled'
  }
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

// Apple puts whatever nonce we send into its ID token. Supabase hashes the raw
// nonce itself and compares, so Apple gets the SHA-256 and Supabase the raw one.
export async function makeNonce() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)))
  const hashed = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
  return { raw, hashed }
}

// AI-DEV NOTE: resolves the plugin's sign-in RESULT, never the plugin object.
// Returning a Capacitor plugin proxy from an async function makes the Promise
// call its "then" method, which throws on native (memory capacitor-plugin-proxy-thenable).
async function appleSignIn(options) {
  const { AppleSignIn, SignInScope } = await import('@capawesome/capacitor-apple-sign-in')
  try {
    return await AppleSignIn.signIn({ scopes: [SignInScope.Email, SignInScope.FullName], ...options })
  } catch (err) {
    if (err?.code === 'SIGN_IN_CANCELED') throw new AppleSignInCanceled()
    throw err
  }
}

// Returns { data, error } like the other supabase.auth sign-ins, or
// { canceled: true } when the user closes Apple's sheet (no error shown).
export async function signInWithApple(supabase) {
  const nonce = await makeNonce()
  let result
  try {
    result = await appleSignIn({ nonce: nonce.hashed })
  } catch (err) {
    if (err instanceof AppleSignInCanceled) return { canceled: true }
    return { error: err }
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple', token: result.idToken, nonce: nonce.raw,
  })
  if (error) return { data, error }
  // Apple shares the name only on the very first sign-in, and it is not in the
  // ID token. Keep it so onboarding can pre-fill "Your name".
  const fullName = [result.givenName, result.familyName].filter(Boolean).join(' ').trim()
  if (fullName && !data?.user?.user_metadata?.full_name) {
    await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {})
  }
  return { data, error: null }
}

export function hasAppleIdentity(user) {
  return (user?.identities ?? []).some((i) => i.provider === 'apple')
}

// sessionStorage key AuthPage reads once after a deletion that could not revoke Apple access.
export const APPLE_NOTE_KEY = 'nk_apple_manual_revoke'

// Shown after deletion when Apple access could not be revoked for the user.
export const APPLE_MANUAL_REVOKE_NOTE =
  'Your account is deleted. To finish, remove Nithyakarma in iPhone Settings > your name > Sign in with Apple.'

// AI-DEV NOTE: Apple requires revoking an Apple user's tokens when they delete
// their account (TN3194). Apple only gives the tokens to our server, so we ask
// Apple for a fresh authorization code and the apple-revoke edge function
// exchanges and revokes it. Returns 'none' (no Apple identity), 'revoked', or
// 'manual' (revoke not possible: deletion still goes ahead, TN3194 says it must,
// and the user is told to remove the app in Settings). Throws
// AppleSignInCanceled when they close Apple's sheet: deletion is then aborted.
export async function revokeAppleBeforeDelete(supabase, user) {
  if (!hasAppleIdentity(user)) return 'none'
  if (!appleSignInAvailable()) return 'manual'
  const result = await appleSignIn({})
  try {
    const { data, error } = await supabase.functions.invoke('apple-revoke', {
      body: { authorizationCode: result.authorizationCode },
    })
    return !error && data?.revoked === true ? 'revoked' : 'manual'
  } catch {
    return 'manual'
  }
}
