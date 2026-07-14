import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({ session: null, profile: null, loading: true }),
  AuthProvider: ({ children }) => children,
}))
// Gate() never renders the real page components while loading=true, but they
// (and lib/supabase.js, which throws without env vars at module-load time)
// still get imported transitively - stub it so this test doesn't depend on
// VITE_SUPABASE_URL/KEY being set, which CI's verify job doesn't set.
vi.mock('./lib/supabase', () => ({ supabase: {} }))

import App from './App'

describe('App Gate loading watchdog', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows a bare spinner before the watchdog fires', () => {
    render(<App />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Taking longer than expected.')).not.toBeInTheDocument()
  })

  it('offers a Reload fallback instead of hanging forever once loading exceeds the watchdog timeout', () => {
    render(<App />)
    act(() => { vi.advanceTimersByTime(15000) })
    expect(screen.getByText('Taking longer than expected.')).toBeInTheDocument()
    expect(screen.getByText('Reload')).toBeInTheDocument()
  })
})
