import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  profile: {
    display_name: 'Ravi Kumar', punya: 0, current_streak: 0, best_streak: 0,
    referral_code: 'ref123', leaderboard_opt_in: false, community_enabled: true,
    panchangam_tradition: 'tamil',
  },
  updateProfile: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { email: 'ravi@example.com' } },
    profile: h.profile,
    familyMembers: [],
    updateProfile: h.updateProfile,
    addFamilyMember: vi.fn(),
    removeFamilyMember: vi.fn(),
    deleteAccount: vi.fn(),
    signOut: vi.fn(),
  }),
}))
vi.mock('../NotificationSettings', () => ({ default: () => null }))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import ProfilePage from '../ProfilePage'

beforeEach(() => {
  h.updateProfile = vi.fn(() => Promise.resolve())
  h.profile.panchangam_tradition = 'tamil'
})

const renderPage = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>)

describe('ProfilePage panchangam tradition preference', () => {
  it('shows Tamil selected by default', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Tamil' }).className).toContain('on')
    expect(screen.getByRole('button', { name: 'Malayalam' }).className).not.toContain('on')
  })

  it('clicking Malayalam calls updateProfile with the right value and flips the selection', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Malayalam' }))
    expect(h.updateProfile).toHaveBeenCalledWith({ panchangam_tradition: 'malayalam' })
    expect(await screen.findByRole('button', { name: 'Malayalam' })).toHaveClass('on')
  })

  it('reverts the visual selection when the update fails', async () => {
    h.updateProfile = vi.fn(() => Promise.reject(new Error('network error')))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Malayalam' }))
    expect(await screen.findByRole('button', { name: 'Tamil' })).toHaveClass('on')
    expect(screen.getByRole('button', { name: 'Malayalam' }).className).not.toContain('on')
  })
})
