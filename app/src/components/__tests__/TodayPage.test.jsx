import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Child components pull in ads/router/localStorage - not under test here.
vi.mock('../ProfileSwitcher', () => ({ default: () => null }))
vi.mock('../CelebrationModal', () => ({ default: () => null }))
vi.mock('../GuidedTour', () => ({ default: () => null }))

const h = vi.hoisted(() => ({ items: [] }))
vi.mock('../../hooks/useToday', () => ({
  useToday: () => ({ items: h.items, loading: false, submit: vi.fn(), addPractice: vi.fn() }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { gender: 'male', display_name: 'Test User', current_streak: 0, best_streak: 0 },
    selectedMember: null,
    refresh: vi.fn(),
  }),
}))
// AddPracticeDropdown fetches the catalog on mount.
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) },
}))

import TodayPage from '../TodayPage'

const sandhyaItem = (slots) => ({
  up: { id: 'up-s', current_streak: 0, sequence_position: 0 },
  practice: { id: 1, name: 'Sandhyavandhanam', icon: '🕉', is_sandhyavandhanam: true, cadence: 'daily' },
  logs: slots.map(s => ({ slot: s })),
})

beforeEach(() => { h.items = [] })

describe('TodayPage - Sandhyavandhanam UX', () => {
  it('shows "1 of 3 sandhyas done" after a single slot (the reported 0-not-1 case, surfaced clearly)', () => {
    h.items = [sandhyaItem(['morning'])]
    render(<TodayPage />)
    expect(screen.getByText('1 of 3 sandhyas done')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 anushtanams done.')).toBeInTheDocument()
  })

  it('shows "2 of 3" after two slots and still not done', () => {
    h.items = [sandhyaItem(['morning', 'afternoon'])]
    render(<TodayPage />)
    expect(screen.getByText('2 of 3 sandhyas done')).toBeInTheDocument()
  })

  it('shows completion once all 3 slots are marked', () => {
    h.items = [sandhyaItem(['morning', 'afternoon', 'evening'])]
    render(<TodayPage />)
    expect(screen.getByText('All 3 sandhyas done 🎉')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 anushtanams done.')).toBeInTheDocument()
  })

  it('the "!" info button toggles the 3-slot explainer', () => {
    h.items = [sandhyaItem([])]
    render(<TodayPage />)
    const info = screen.getByRole('button', { name: /Why does Sandhyavandhanam need three marks/ })
    expect(info).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/performed 3 times a day/)).toBeInTheDocument()
  })
})
