import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const auth = vi.hoisted(() => ({ session: null, profile: null, loading: false }))

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

// Gate() must show the notification prompt exactly once, right as profile
// flips from absent to present (onboarding just completed) - never on a
// normal app load/refresh for an already-onboarded returning user, where
// profile is momentarily null only during the initial auth fetch.
describe('App Gate notification prompt', () => {
  beforeEach(() => {
    auth.session = { user: { id: 'u1' } }
    auth.profile = null
    auth.loading = false
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

  it('shows the prompt once profile appears right after Onboarding was shown', async () => {
    auth.profile = null
    const { rerender } = render(<App />)
    await act(async () => {})
    expect(screen.getByText('ONBOARDING_STUB')).toBeInTheDocument()

    auth.profile = { id: 'p1', gender: 'male' }
    await act(async () => rerender(<App />))

    expect(screen.getByText('NOTIF_PROMPT_STUB')).toBeInTheDocument()
    expect(screen.queryByText('TODAY_STUB')).not.toBeInTheDocument()
  })

  it('proceeds to the main app once the prompt calls onDone', async () => {
    auth.profile = null
    const { rerender } = render(<App />)
    await act(async () => {})

    auth.profile = { id: 'p1', gender: 'male' }
    await act(async () => rerender(<App />))
    expect(screen.getByText('NOTIF_PROMPT_STUB')).toBeInTheDocument()

    screen.getByText('done').click()
    await act(async () => rerender(<App />))

    expect(screen.getByText('TODAY_STUB')).toBeInTheDocument()
    expect(screen.queryByText('NOTIF_PROMPT_STUB')).not.toBeInTheDocument()
  })
})
