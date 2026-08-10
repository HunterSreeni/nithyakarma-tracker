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
  familyMembers: [],
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { email: 'ravi@example.com' } },
    profile: h.profile,
    familyMembers: h.familyMembers,
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
  h.familyMembers = []
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

describe('ProfilePage family member punya and tier', () => {
  it("shows each child's own punya and tier, independent of the parent's", () => {
    h.profile.punya = 500 // parent is Yogi tier - must not leak into the child's row
    h.familyMembers = [
      { id: 'fm1', name: 'Arjun', gender: 'male', upanayanam_done: true, punya: 5, current_streak: 0 },
      { id: 'fm2', name: 'Devika', gender: 'female', punya: 120, current_streak: 0 },
    ]
    renderPage()
    const arjunRow = screen.getByText('Arjun').closest('.fam-row')
    expect(arjunRow).toHaveTextContent('5 punya')
    expect(arjunRow).toHaveTextContent('Shishya')

    const devikaRow = screen.getByText('Devika').closest('.fam-row')
    expect(devikaRow).toHaveTextContent('120 punya')
    expect(devikaRow).toHaveTextContent('Sadhaka')
  })
})
