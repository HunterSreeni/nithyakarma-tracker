import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createProfile = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ createProfile, session: { user: { user_metadata: {} } } }),
}))

import Onboarding from '../Onboarding'

beforeEach(() => {
  vi.clearAllMocks()
  window.history.pushState({}, '', '/')
})

describe('Onboarding', () => {
  it('shows the value-prop intro first, then reveals the form', () => {
    render(<Onboarding />)
    expect(screen.getByText(/Build a streak/)).toBeInTheDocument()
    expect(screen.getByText(/Join the Sabha/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Get started/))
    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
  })

  it('requires a gender before creating the profile', async () => {
    render(<Onboarding />)
    fireEvent.click(screen.getByText(/Get started/))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } })
    fireEvent.click(screen.getByText(/Begin/))
    expect(await screen.findByText(/select gender/i)).toBeInTheDocument()
    expect(createProfile).not.toHaveBeenCalled()
  })

  it('still flows the /r/:code referral through to createProfile', async () => {
    window.history.pushState({}, '', '/r/ABC123')
    render(<Onboarding />)
    fireEvent.click(screen.getByText(/Get started/))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } })
    fireEvent.click(screen.getByText('Male'))
    fireEvent.click(screen.getByText(/Begin/))
    await waitFor(() => expect(createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ravi', gender: 'male', referralCode: 'ABC123' }),
    ))
  })
})
