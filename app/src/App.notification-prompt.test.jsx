import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const auth = vi.hoisted(() => ({ session: null, profile: null, loading: false, justOnboarded: false, clearJustOnboarded: () => {} }))

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }) => children,
}))
vi.mock('./lib/supabase', () => ({ supabase: {} }))
vi.mock('./components/Onboarding', () => ({ default: () => <div>ONBOARDING_STUB</div> }))
vi.mock('./components/NotificationPrompt', () => ({
  default: ({ onDone }) => <div>NOTIF_PROMPT_STUB<button onClick={onDone}>done</button></div>,
}))
vi.mock('./components/TodayPage', () => ({ default: () => <div>TODAY_STUB</div> }))
vi.mock('./components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))

import App from './App'

// Gate() must show the notification prompt exactly once, driven by useAuth's
// justOnboarded flag - never inferred from session/profile timing, since a
// normal sign-in of an already-onboarded user also has a brief window where
// session is set and profile hasn't loaded yet (profile is a separate async
// fetch after the auth event), which used to false-trigger this prompt on
// every login, not just the first one (regression found + fixed 2026-07-23).
describe('App Gate notification prompt', () => {
  beforeEach(() => {
    auth.session = { user: { id: 'u1' } }
    auth.profile = null
    auth.loading = false
    auth.justOnboarded = false
    auth.clearJustOnboarded = vi.fn(() => { auth.justOnboarded = false })
  })

  it('does not show the prompt for a returning user whose profile was already loading', async () => {
    auth.loading = true
    auth.profile = null
    const { rerender } = render(<App />)

    auth.loading = false
    auth.profile = { id: 'p1', gender: 'male' }
    await act(async () => rerender(<App />))

    expect(screen.getByText('TODAY_STUB')).toBeInTheDocument()
    expect(screen.queryByText('NOTIF_PROMPT_STUB')).not.toBeInTheDocument()
  })

  it('does not show the prompt on a normal sign-in of an existing user, even though profile briefly lags session', async () => {
    auth.session = null
    auth.profile = null
    const { rerender } = render(<App />)
    await act(async () => {})

    // Sign-in event: session appears first, profile still loading - this is
    // the exact shape that used to false-trigger the prompt.
    auth.session = { user: { id: 'u1' } }
    auth.profile = null
    await act(async () => rerender(<App />))

    // Profile finishes loading a tick later. justOnboarded was never set,
    // since createProfile() (onboarding) never ran.
    auth.profile = { id: 'p1', gender: 'male' }
    await act(async () => rerender(<App />))

    expect(screen.getByText('TODAY_STUB')).toBeInTheDocument()
    expect(screen.queryByText('NOTIF_PROMPT_STUB')).not.toBeInTheDocument()
  })

  it('shows the prompt once justOnboarded flips true right after Onboarding was shown', async () => {
    auth.profile = null
    const { rerender } = render(<App />)
    await act(async () => {})
    expect(screen.getByText('ONBOARDING_STUB')).toBeInTheDocument()

    // createProfile() loads the new profile, then sets justOnboarded - both
    // land together from Gate's perspective.
    auth.profile = { id: 'p1', gender: 'male' }
    auth.justOnboarded = true
    await act(async () => rerender(<App />))

    expect(screen.getByText('NOTIF_PROMPT_STUB')).toBeInTheDocument()
    expect(screen.queryByText('TODAY_STUB')).not.toBeInTheDocument()
    expect(auth.clearJustOnboarded).toHaveBeenCalled()
  })

  it('proceeds to the main app once the prompt calls onDone', async () => {
    auth.profile = null
    const { rerender } = render(<App />)
    await act(async () => {})

    auth.profile = { id: 'p1', gender: 'male' }
    auth.justOnboarded = true
    await act(async () => rerender(<App />))
    expect(screen.getByText('NOTIF_PROMPT_STUB')).toBeInTheDocument()

    screen.getByText('done').click()
    await act(async () => rerender(<App />))

    expect(screen.getByText('TODAY_STUB')).toBeInTheDocument()
    expect(screen.queryByText('NOTIF_PROMPT_STUB')).not.toBeInTheDocument()
  })
})
