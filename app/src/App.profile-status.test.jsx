import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

const auth = vi.hoisted(() => ({}))

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }) => children,
}))
vi.mock('./lib/supabase', () => ({ supabase: {} }))
vi.mock('./components/Onboarding', () => ({ default: () => <div>ONBOARDING_STUB</div> }))
vi.mock('./components/TodayPage', () => ({ default: () => <div>TODAY_STUB</div> }))
vi.mock('./components/Layout', () => ({ default: ({ children }) => <div>{children}</div> }))

import App from './App'

// F1 (state machine audit, 2026-11-09): "profile not fetched yet" and "no
// profile" used to be the same null, so an existing user saw Onboarding on
// every fresh sign-in and was stranded on it when the fetch failed.
describe('App Gate profile status', () => {
  beforeEach(() => {
    Object.assign(auth, {
      session: { user: { id: 'u1' } }, profile: null, profileStatus: 'loading',
      loading: false, dataStatus: 'ready', justOnboarded: false,
      clearJustOnboarded: vi.fn(), refresh: vi.fn(() => Promise.resolve()),
    })
  })

  it('shows a spinner, not Onboarding, while the profile of a signed-in user is still loading', async () => {
    render(<App />)
    await act(async () => {})
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument()
  })

  it('also waits on an unknown status (sign-in event before the fetch starts)', async () => {
    auth.profileStatus = 'unknown'
    render(<App />)
    await act(async () => {})
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument()
  })

  it('shows Onboarding only once the profile is confirmed absent', async () => {
    auth.profileStatus = 'absent'
    render(<App />)
    expect(await screen.findByText('ONBOARDING_STUB')).toBeInTheDocument()
  })

  it('shows Retry instead of Onboarding when the profile fetch failed', async () => {
    auth.profileStatus = 'error'
    render(<App />)
    await act(async () => {})
    expect(screen.queryByText('ONBOARDING_STUB')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(auth.refresh).toHaveBeenCalled()
  })

  it('says offline rather than spinning forever when the profile cannot load offline', async () => {
    auth.dataStatus = 'offline'
    render(<App />)
    await act(async () => {})
    expect(screen.getByText("You're offline. Reconnect to continue.")).toBeInTheDocument()
  })

  it('goes straight to the app when the profile is present', async () => {
    auth.profile = { id: 'u1', gender: 'male' }
    auth.profileStatus = 'present'
    render(<App />)
    expect(await screen.findByText('TODAY_STUB')).toBeInTheDocument()
  })
})
