import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import Turnstile, { TURNSTILE_ENABLED } from './Turnstile'

export default function AuthPage() {
  const { signInGoogle, signInEmail, signUpEmail, resetPassword } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const turnstileRef = useRef(null)
  // Resolves the in-flight getFreshCaptchaToken() wait once a real (non-null)
  // token arrives from the widget - see handleCaptchaVerify below.
  const captchaWaiterRef = useRef(null)

  const handleCaptchaVerify = (token) => {
    setCaptchaToken(token)
    if (token && captchaWaiterRef.current) {
      const resolve = captchaWaiterRef.current
      captchaWaiterRef.current = null
      resolve(token)
    }
  }

  // Turnstile tokens are single-use, so a retry needs a fresh one, not the
  // token that just got consumed by the failed attempt. Reset the widget and
  // wait for its callback to hand back a new token, capped at 8s in case the
  // challenge itself can't complete (e.g. the same network trouble that
  // caused the timeout) - the caller then just retries with whatever it got.
  const getFreshCaptchaToken = () => {
    if (!TURNSTILE_ENABLED) return Promise.resolve(null)
    return new Promise((resolve) => {
      let settled = false
      const finish = (token) => {
        if (settled) return
        settled = true
        captchaWaiterRef.current = null
        resolve(token)
      }
      captchaWaiterRef.current = finish
      setTimeout(() => finish(null), 8000)
      setCaptchaToken(null)
      turnstileRef.current?.reset()
    })
  }

  // supabase-js wraps every fetch failure - our 12s timeout abort, a dropped
  // connection, a transient 5xx - into AuthRetryableFetchError, discarding
  // the original error's name/type. This is the library's own "safe to
  // retry" signal, so check it rather than trying to sniff out our timeout
  // specifically (which no longer survives past the fetch layer).
  const friendlyMessage = (error) =>
    isAuthRetryableFetchError(error)
      ? 'Network seems slow right now. Please check your connection and try again.'
      : error.message

  // A hung/dropped request on mobile data is common and usually transient -
  // retry once, silently, before bothering the user with an error.
  const callWithRetry = async (fn, token) => {
    const result = await fn(token)
    if (!result.error || !isAuthRetryableFetchError(result.error)) return result
    const freshToken = await getFreshCaptchaToken()
    // If the widget can't produce a fresh token in time - likely, since it is
    // the same flaky network that timed the request out - retrying with a null
    // token guarantees a "no captcha_token found" rejection from GoTrue. That
    // would replace an accurate network error with a confusing captcha one, so
    // keep the original error instead.
    if (TURNSTILE_ENABLED && !freshToken) return result
    return fn(freshToken)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setNotice(null); setBusy(true)
    if (mode === 'forgot') {
      const { error } = await callWithRetry((token) => resetPassword(email, token), captchaToken)
      turnstileRef.current?.reset(); setCaptchaToken(null)
      setBusy(false)
      if (error) { setError(friendlyMessage(error)); return }
      setNotice(`If an account exists for ${email}, a reset link is on its way. Check your inbox and spam.`)
      return
    }
    const fn = mode === 'login' ? signInEmail : signUpEmail
    const { data, error } = await callWithRetry((token) => fn(email, password, token), captchaToken)
    turnstileRef.current?.reset(); setCaptchaToken(null)
    setBusy(false)
    if (error) { setError(friendlyMessage(error)); return }
    // Signup with email confirmation on: user exists but no session yet
    if (mode === 'signup' && data?.user && !data?.session) {
      setNotice(`Verification email sent to ${email}. Please check your inbox (and spam) and click the link, then sign in.`)
      setMode('login')
    }
  }

  return (
    <div className="auth-split">
      {/* Periyava hero - left panel on web, top on mobile */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <img className="auth-peryava" src="/periyava.jpg" alt="Periyava" />
          <div className="auth-hero-title">Nithya Karma Anushtanam</div>
          <div className="auth-hero-sub">Anudinam anushtanam</div>
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-panel">
        <div className="auth-formwrap">
          <img src="/wordmark.png" alt="Nithyakarma" className="auth-logo-img" />
          <h1 className="auth-welcome">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Get started' : 'Reset password'}
          </h1>
          <div className="auth-sub">
            {mode === 'login' ? 'Sign in to continue your practice.'
              : mode === 'signup' ? 'Create your account to begin.'
              : 'Enter your email and we will send you a reset link.'}
          </div>

          {mode !== 'forgot' && (
            <>
              <button className="btn-google" onClick={signInGoogle}>
                <span>G</span> Continue with Google
              </button>
              <div className="auth-or">or with email</div>
            </>
          )}

          <form onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">Email</label>
            <input id="auth-email" className="field-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            {mode !== 'forgot' && (
              <>
                <label className="field-label" htmlFor="auth-password">Password</label>
                <input id="auth-password" className="field-input" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </>
            )}
            {mode === 'login' && (
              <button type="button" className="auth-forgot"
                onClick={() => { setMode('forgot'); setError(null); setNotice(null) }}>
                Forgot password?
              </button>
            )}
            <Turnstile ref={turnstileRef} onVerify={handleCaptchaVerify} />
            {error && <div className="auth-error" role="alert">{error}</div>}
            {notice && <div className="auth-notice">{notice}</div>}
            <button className="btn-auth" type="submit" disabled={busy || (TURNSTILE_ENABLED && !captchaToken)}>
              {TURNSTILE_ENABLED && !captchaToken
                ? 'Verifying...'
                : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send reset link'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'forgot' ? (
              <button onClick={() => { setMode('login'); setError(null); setNotice(null) }}>Back to sign in</button>
            ) : (
              <>
                {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
                <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
                  {mode === 'login' ? 'Create account' : 'Sign in'}
                </button>
              </>
            )}
          </div>

          <div className="auth-agree">
            By continuing you agree to our <Link to="/terms">Terms</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>.
          </div>
        </div>
      </div>
    </div>
  )
}
