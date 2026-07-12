import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const signInGoogle = vi.fn()
const signInEmail = vi.fn().mockResolvedValue({ error: null })
const signUpEmail = vi.fn().mockResolvedValue({ error: null })
const resetPassword = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signInGoogle, signInEmail, signUpEmail, resetPassword }),
}))

const mockNative = vi.fn().mockReturnValue(false)
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

import AuthPage from '../AuthPage'

beforeEach(() => {
  vi.clearAllMocks()
  mockNative.mockReturnValue(false)
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
    await waitFor(() => expect(signInEmail).toHaveBeenCalledWith('a@b.com', 'secret123'))
  })

  it('switches to signup mode and calls signUpEmail', async () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Create account'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Create Account'))
    await waitFor(() => expect(signUpEmail).toHaveBeenCalledWith('new@b.com', 'secret123'))
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

  it('hides Google sign-in on native (no deep-link return there)', () => {
    mockNative.mockReturnValue(true)
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    expect(screen.queryByText(/Continue with Google/)).not.toBeInTheDocument()
    // email/password still available
    expect(screen.getByText('Sign In')).toBeInTheDocument()
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

  it('offers a password reset flow from the login form', async () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Forgot password?'))
    // reset mode drops the password field and swaps the CTA
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByText('Send reset link'))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('a@b.com'))
    expect(await screen.findByText(/reset link is on its way/)).toBeInTheDocument()
  })
})
