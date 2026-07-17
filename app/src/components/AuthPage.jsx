import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Turnstile from './Turnstile'

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

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setNotice(null); setBusy(true)
    if (mode === 'forgot') {
      const { error } = await resetPassword(email, captchaToken)
      turnstileRef.current?.reset()
      setBusy(false)
      if (error) { setError(error.message); return }
      setNotice(`If an account exists for ${email}, a reset link is on its way. Check your inbox and spam.`)
      return
    }
    const fn = mode === 'login' ? signInEmail : signUpEmail
    const { data, error } = await fn(email, password, captchaToken)
    turnstileRef.current?.reset()
    setBusy(false)
    if (error) { setError(error.message); return }
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
          <div className="auth-logo">Nithya<span>karma</span></div>
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
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />
            {error && <div className="auth-error" role="alert">{error}</div>}
            {notice && <div className="auth-notice">{notice}</div>}
            <button className="btn-auth" type="submit" disabled={busy}>
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send reset link'}
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
