import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const updatePassword = vi.fn().mockResolvedValue({ error: null })
const navigate = vi.fn()
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ updatePassword }) }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))

import ResetPassword from '../ResetPassword'

beforeEach(() => vi.clearAllMocks())

describe('ResetPassword', () => {
  it('sets the new password and confirms', async () => {
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newsecret1' } })
    fireEvent.click(screen.getByText('Update password'))
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('newsecret1'))
    expect(await screen.findByText(/Password updated/)).toBeInTheDocument()
  })

  it('surfaces an error (e.g. expired/invalid recovery link)', async () => {
    updatePassword.mockResolvedValueOnce({ error: { message: 'Auth session missing' } })
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newsecret1' } })
    fireEvent.click(screen.getByText('Update password'))
    expect(await screen.findByText('Auth session missing')).toBeInTheDocument()
  })
})
