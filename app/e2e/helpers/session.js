import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.E2E_UI_EMAIL

export const SEEDING_CONFIGURED = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY && EMAIL)

// Why a session is seeded instead of typed into the sign-in form:
//
// Supabase Auth's captcha protection is on for this project, and it guards the
// endpoints that *start* a session (/signup, /token?grant_type=password, /otp,
// /recover). Cloudflare Turnstile will not issue a token to a headless browser
// (confirmed - it can hang 40s+ with no callback), and Turnstile's own dummy
// test sitekeys are no help either: a dummy token only validates against a
// dummy *secret*, and this project holds the real one. So a UI password
// sign-in can never succeed in CI without weakening production.
//
// /admin/generate_link and /verify are not captcha-gated, so this mints a real
// session server-side and hands it to the browser in exactly the shape
// supabase-js would have stored it. Nothing in production is changed, and no
// account password is needed.
//
// AuthPage's own sign-in behaviour (error display, retry, captcha gating) is
// covered by src/components/__tests__/AuthPage.test.jsx.
//
// ONE session per process, not one per test. Every call used to mint a brand
// new magiclink, which was fine while two specs seeded once each. calendar.spec
// .js seeds in a beforeEach, taking the suite from 2 mints to 13 inside ~40s,
// and CI then failed partway with "Email link is invalid or has expired".
// Supabase keeps a single outstanding magiclink token per user and de-duplicates
// repeat generateLink calls inside a short resend window, so a rapid burst can
// hand back a token that an earlier verifyOtp already consumed. A session is
// valid for an hour and the whole suite finishes in well under a minute, so
// minting once and reusing it is both correct and faster.
let cached = null

// `fresh: true` mints a throwaway session and leaves the shared one alone. Use
// it from any spec that ends the session it was given - the app's signOut()
// takes no scope argument, so it is supabase-js's default 'global', which
// revokes every refresh token for the account and would otherwise poison the
// cache for the specs that run afterwards.
export async function seedSession(page, { fresh = false } = {}) {
  if (!SEEDING_CONFIGURED) throw new Error('seedSession() called without VITE_SUPABASE_URL / VITE_SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY / E2E_UI_EMAIL')

  const session = !fresh && cached ? cached : await mintSession()
  if (!fresh) cached = session

  // supabase-js's own storage contract (v2.110.0): the key is derived from the
  // project ref and the value is the plain JSON session - see
  // supabase-js SupabaseClient (sb-<ref>-auth-token) and auth-js
  // helpers.setItemAsync (JSON.stringify, no wrapper).
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: JSON.stringify(session) },
  )
  return session
}

async function mintSession() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
  })
  if (linkError) throw new Error(`generateLink failed: ${linkError.message}`)

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`)
  if (!verified.session) throw new Error('verifyOtp returned no session')

  return verified.session
}
