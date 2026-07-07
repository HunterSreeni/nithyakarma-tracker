import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const signInGoogle = vi.fn()
const signInEmail = vi.fn().mockResolvedValue({ error: null })
const signUpEmail = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signInGoogle, signInEmail, signUpEmail }),
}))

import AuthPage from '../AuthPage'

beforeEach(() => vi.clearAllMocks())

describe('AuthPage', () => {
  it('offers Google and email sign-in', () => {
    render(<AuthPage />)
    expect(screen.getByText(/Continue with Google/)).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('signs in with email and password', async () => {
    render(<AuthPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(signInEmail).toHaveBeenCalledWith('a@b.com', 'secret123'))
  })

  it('switches to signup mode and calls signUpEmail', async () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Create account'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('Create Account'))
    await waitFor(() => expect(signUpEmail).toHaveBeenCalledWith('new@b.com', 'secret123'))
  })

  it('shows auth errors', async () => {
    signInEmail.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    render(<AuthPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByText('Sign In'))
    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })

  it('starts Google OAuth on click', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText(/Continue with Google/))
    expect(signInGoogle).toHaveBeenCalled()
  })
})
