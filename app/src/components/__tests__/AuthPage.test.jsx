import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthRetryableFetchError } from '@supabase/supabase-js'

const signInGoogle = vi.fn()
const signInEmail = vi.fn().mockResolvedValue({ error: null })
const signUpEmail = vi.fn().mockResolvedValue({ error: null })
const resetPassword = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signInGoogle, signInEmail, signUpEmail, resetPassword }),
}))
// Real Turnstile needs a live Cloudflare widget/network round trip - not
// available in jsdom. Mock it as always-verified so submit stays enabled,
// matching TURNSTILE_ENABLED === false (no site key) behavior in these unit
// tests: captchaToken stays null and every auth call gets null, same as
// before this widget existed.
vi.mock('../Turnstile', () => ({
  default: () => null,
  TURNSTILE_ENABLED: false,
}))

import AuthPage from '../AuthPage'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthPage', () => {
  it('offers Google and email sign-in', () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    expect(screen.getByText(/Continue with Google/)).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('signs in with email and password', async () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(signInEmail).toHaveBeenCalledWith('a@b.com', 'secret123', null))
  })

  it('switches to signup mode and calls signUpEmail', async () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Create account'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Create Account'))
    await waitFor(() => expect(signUpEmail).toHaveBeenCalledWith('new@b.com', 'secret123', null))
  })

  it('shows auth errors', async () => {
    signInEmail.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByText('Sign In'))
    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })

  it('starts Google OAuth on click', () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText(/Continue with Google/))
    expect(signInGoogle).toHaveBeenCalled()
  })

  it('shows the email-verification notice after signup (no session yet)', async () => {
    signUpEmail.mockResolvedValueOnce({ data: { user: { id: 'u1' }, session: null }, error: null })
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Create account'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Create Account'))
    expect(await screen.findByText(/Verification email sent to new@b.com/)).toBeInTheDocument()
    // and returns to login mode so the user can sign in after verifying
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('shows no verification notice when signup returns a live session', async () => {
    signUpEmail.mockResolvedValueOnce({ data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null })
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Create account'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Create Account'))
    await waitFor(() => expect(signUpEmail).toHaveBeenCalled())
    expect(screen.queryByText(/Verification email sent/)).not.toBeInTheDocument()
  })

  it('requires an 8-character minimum password (Supabase Auth policy match)', () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    expect(screen.getByLabelText('Password')).toHaveAttribute('minLength', '8')
  })

  it('silently retries once on a timed-out/dropped request and succeeds', async () => {
    // This is what a fetch timeout/dropped connection actually looks like by
    // the time it reaches AuthPage - supabase-js wraps it into
    // AuthRetryableFetchError, not a raw TimeoutError.
    signInEmail
      .mockResolvedValueOnce({ error: new AuthRetryableFetchError('Request timed out after 12000ms', 0) })
      .mockResolvedValueOnce({ error: null })
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(2))
    // no error shown - the retry succeeded transparently
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a friendly message when the retry also times out', async () => {
    signInEmail.mockResolvedValue({ error: new AuthRetryableFetchError('Request timed out after 12000ms', 0) })
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Network seems slow/)).toBeInTheDocument()
    expect(screen.queryByText(/Request timed out/)).not.toBeInTheDocument()
  })

  it('never retries with a null captcha token when Turnstile is enabled', async () => {
    // Turnstile on, but the widget can never hand back a fresh token (same
    // flaky network that timed the request out). Retrying with null would be
    // rejected by GoTrue as "no captcha_token found", so the retry must be
    // skipped and the accurate network error kept.
    vi.resetModules()
    vi.doMock('../Turnstile', () => ({
      default: () => null,
      TURNSTILE_ENABLED: true,
    }))
    const { default: GatedAuthPage } = await import('../AuthPage')
    signInEmail.mockResolvedValue({ error: new AuthRetryableFetchError('Request timed out after 12000ms', 0) })
    render(<MemoryRouter><GatedAuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form'))
    expect(await screen.findByText(/Network seems slow/, {}, { timeout: 12000 })).toBeInTheDocument()
    // exactly one attempt: the retry was skipped rather than sent tokenless
    expect(signInEmail).toHaveBeenCalledTimes(1)
    vi.doUnmock('../Turnstile')
  }, 15000)

  it('offers a password reset flow from the login form', async () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Forgot password?'))
    // reset mode drops the password field and swaps the CTA
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByText('Send reset link'))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('a@b.com', null))
    expect(await screen.findByText(/reset link is on its way/)).toBeInTheDocument()
  })
})
