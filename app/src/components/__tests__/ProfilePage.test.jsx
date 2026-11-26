import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  profile: {
    display_name: 'Ravi Kumar', punya: 0, current_streak: 0, best_streak: 0,
    referral_code: 'ref123', leaderboard_opt_in: false, community_enabled: true,
    panchangam_tradition: 'tamil',
  },
  updateProfile: vi.fn(() => Promise.resolve()),
  familyMembers: [],
  addFamilyMember: vi.fn(),
  session: { user: { email: 'ravi@example.com' } },
  deleteAccount: vi.fn(),
  jadhagam: true,
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: h.session,
    profile: h.profile,
    familyMembers: h.familyMembers,
    updateProfile: h.updateProfile,
    addFamilyMember: h.addFamilyMember,
    removeFamilyMember: vi.fn(),
    deleteAccount: h.deleteAccount,
    signOut: vi.fn(),
  }),
}))
vi.mock('../NotificationSettings', () => ({ default: () => null }))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
vi.mock('../../utils/features', () => ({ get JADHAGAM_ENABLED() { return h.jadhagam } }))

import ProfilePage from '../ProfilePage'
import { AppleSignInCanceled } from '../../utils/appleAuth'

beforeEach(() => {
  h.updateProfile = vi.fn(() => Promise.resolve())
  h.profile.panchangam_tradition = 'tamil'
  h.familyMembers = []
  h.session = { user: { email: 'ravi@example.com' } }
  h.deleteAccount = vi.fn(() => Promise.resolve())
  h.jadhagam = true
})

const renderPage = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>)

describe('ProfilePage account deletion with Sign in with Apple', () => {
  const confirmDelete = () => {
    fireEvent.change(screen.getByPlaceholderText('ravi@example.com'), { target: { value: 'ravi@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Delete my account/ }))
  }

  it('tells Apple users that Apple will ask them to confirm', () => {
    h.session = { user: { email: 'ravi@example.com', identities: [{ provider: 'apple', id: '001.a.1' }] } }
    renderPage()
    expect(screen.getByText(/Apple will then ask you to confirm once more/)).toBeInTheDocument()
  })

  it('says nothing about Apple to everyone else', () => {
    renderPage()
    expect(screen.queryByText(/Apple will then ask/)).not.toBeInTheDocument()
  })

  it('closing Apple\'s sheet cancels quietly, with no error', async () => {
    h.deleteAccount = vi.fn(() => Promise.reject(new AppleSignInCanceled()))
    renderPage()
    confirmDelete()
    await waitFor(() => expect(h.deleteAccount).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('still reports a real deletion failure', async () => {
    h.deleteAccount = vi.fn(() => Promise.reject(Object.assign(new Error('boom'), { userFacing: true })))
    renderPage()
    confirmDelete()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

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
    // waitFor, not findByRole: the Tamil button exists from first render, so
    // findByRole resolves on the first tick and asserts the class before
    // setTraditionPref's catch has reverted it (ProfilePage.jsx sets the new
    // value synchronously, then reverts a microtask later). That window is
    // wide enough to lose on a loaded CI runner. Poll the class, not the node.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tamil' })).toHaveClass('on'))
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

// F2 (state machine audit): a family add that created the child but failed a
// follow-up step must not leave the form open for a duplicate re-submit.
describe('ProfilePage add family member - partial failure', () => {
  it('closes the form and reports the partial result in the family section', async () => {
    const partial = Object.assign(new Error('Arjun was added, but Sandhyavandhanam could not be added. Add it from Today.'), { partial: true, userFacing: true })
    h.addFamilyMember = vi.fn(() => Promise.reject(partial))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '+ Add family member' }))
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Arjun' } })
    fireEvent.click(screen.getByRole('button', { name: 'Boy' }))
    fireEvent.submit(screen.getByLabelText("Child's name").closest('form'))
    expect(await screen.findByText(/Arjun was added, but Sandhyavandhanam/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Child's name")).not.toBeInTheDocument()
    expect(h.addFamilyMember).toHaveBeenCalledTimes(1)
  })

  it('Cancel just closes the form without a notice', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '+ Add family member' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText("Child's name")).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ProfilePage Jadhagam entry', () => {
  it('shows the Jadhagam card where the feature is on (Android, web)', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Jadhagam \(birth charts\)/ })).toHaveAttribute('href', '/birth-chart')
  })

  it('hides it on iPhone, where it is left out of the App Store build', () => {
    h.jadhagam = false
    renderPage()
    expect(screen.queryByText(/Jadhagam \(birth charts\)/)).not.toBeInTheDocument()
  })
})
