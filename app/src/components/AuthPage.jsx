import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const { signInGoogle, signInEmail, signUpEmail } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setBusy(true)
    const fn = mode === 'login' ? signInEmail : signUpEmail
    const { error } = await fn(email, password)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">🪔 Nithya<span>karma</span></div>
      <div className="auth-sub">Your daily anushtanam companion</div>
      <div className="auth-card">
        <button className="btn-google" onClick={signInGoogle}>
          <span>G</span> Continue with Google
        </button>
        <div className="auth-or">or with email</div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="auth-email">Email</label>
          <input id="auth-email" className="field-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <label className="field-label" htmlFor="auth-password">Password</label>
          <input id="auth-password" className="field-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-auth" type="submit" disabled={busy}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
            {mode === 'login' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
