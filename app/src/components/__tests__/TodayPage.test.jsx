import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Child components pull in ads/router/localStorage - not under test here.
vi.mock('../ProfileSwitcher', () => ({ default: () => null }))
vi.mock('../CelebrationModal', () => ({
  default: ({ data }) => (data ? <div data-testid="celebration">{data.practice_streak}</div> : null),
}))
vi.mock('../GuidedTour', () => ({ default: () => null }))
vi.mock('../PanchangamBox', () => ({ default: () => null }))
vi.mock('../MonthlySpecialBanner', () => ({ default: () => null }))

const h = vi.hoisted(() => ({
  items: [], catalog: [], addPractice: vi.fn(),
  submit: vi.fn(), showInterstitial: vi.fn().mockResolvedValue(false),
  profile: { gender: 'male', display_name: 'Test User', current_streak: 0, best_streak: 0, freeze_credits: 2 },
  selectedMember: null,
}))
vi.mock('../../hooks/useToday', () => ({
  useToday: () => ({ items: h.items, loading: false, submit: h.submit, addPractice: h.addPractice }),
}))
vi.mock('../../utils/ads', () => ({ showInterstitial: (...a) => h.showInterstitial(...a) }))
vi.mock('../../utils/review', () => ({ isMilestone: () => false, maybeRequestReview: vi.fn().mockResolvedValue(false) }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: h.profile,
    selectedMember: h.selectedMember,
    refresh: vi.fn(),
  }),
}))
// AddPracticeDropdown + SuggestedPractices fetch practices on mount.
vi.mock('../../lib/supabase', () => {
  const chain = () => {
    const c = { select: () => c, eq: () => c, in: () => c, order: () => Promise.resolve({ data: h.catalog }) }
    return c
  }
  return { supabase: { from: () => chain() } }
})

import TodayPage from '../TodayPage'

const sandhyaItem = (slots) => ({
  up: { id: 'up-s', current_streak: 0, sequence_position: 0 },
  practice: { id: 1, name: 'Sandhyavandhanam', icon: '🕉', is_sandhyavandhanam: true, cadence: 'daily' },
  logs: slots.map(s => ({ slot: s })),
})

beforeEach(() => {
  h.items = []; h.catalog = []
  h.addPractice.mockClear(); h.submit.mockReset(); h.showInterstitial.mockClear()
  h.profile = { gender: 'male', display_name: 'Test User', current_streak: 0, best_streak: 0, freeze_credits: 2 }
  h.selectedMember = null
})

describe('TodayPage - Sandhyavandhanam UX', () => {
  it('marking a single slot completes the day (2026-07-20: 1 of 3 is enough)', () => {
    h.items = [sandhyaItem(['morning'])]
    render(<TodayPage />)
    expect(screen.getByText('1 of 3 sandhyas done · streak kept')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 anushtanams done.')).toBeInTheDocument()
  })

  it('shows "2 of 3" after two slots, still counted as day-complete', () => {
    h.items = [sandhyaItem(['morning', 'afternoon'])]
    render(<TodayPage />)
    expect(screen.getByText('2 of 3 sandhyas done · streak kept')).toBeInTheDocument()
  })

  it('shows completion once all 3 slots are marked', () => {
    h.items = [sandhyaItem(['morning', 'afternoon', 'evening'])]
    render(<TodayPage />)
    expect(screen.getByText('All 3 sandhyas done')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 anushtanams done.')).toBeInTheDocument()
  })

  it('the "!" info button toggles the 3-slot explainer', () => {
    h.items = [sandhyaItem([])]
    render(<TodayPage />)
    const info = screen.getByRole('button', { name: /Why are there three Sandhyavandhanam times/ })
    expect(info).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/performed 3 times a day/)).toBeInTheDocument()
  })

  it('shows the streak freeze count on the Today card', () => {
    h.items = [sandhyaItem([])]
    render(<TodayPage />)
    expect(screen.getByText(
      (_, el) => el?.className === 'tc-hint' && el.textContent.includes('2 freezes'),
    )).toBeInTheDocument()
  })
})

describe('TodayPage - empty-day activation (female / non-sandhya)', () => {
  const suggestions = [
    { id: 2, slug: 'narayaneeyam', name: 'Narayaneeyam', icon: '🕉️', cadence: 'daily' },
    { id: 3, slug: 'lalitha-sahasranamam', name: 'Lalitha Sahasranamam', icon: '🌺', cadence: 'daily' },
  ]

  it('shows one-tap suggestions instead of an empty screen', async () => {
    h.items = []; h.catalog = suggestions
    render(<TodayPage />)
    expect(await screen.findByText('Suggested to start')).toBeInTheDocument()
    expect(screen.getByText('Narayaneeyam')).toBeInTheDocument()
    expect(screen.getByText('Lalitha Sahasranamam')).toBeInTheDocument()
    expect(screen.getByText('Start with a suggested anushtanam below')).toBeInTheDocument()
  })

  it('adding a suggestion calls addPractice with its id', async () => {
    h.items = []; h.catalog = suggestions
    render(<TodayPage />)
    const addBtn = (await screen.findAllByText('+ Add'))[0]
    fireEvent.click(addBtn)
    await waitFor(() => expect(h.addPractice).toHaveBeenCalledWith(2))
  })
})

describe('TodayPage - ad timing (Intent 0.2 reorder)', () => {
  it('fires the interstitial after a verified save, before the celebration', async () => {
    h.items = [{
      up: { id: 'up1', current_streak: 0, sequence_position: 0 },
      practice: { id: 5, name: 'Vishnu', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
      logs: [],
    }]
    h.submit.mockResolvedValue({ saved: true, day_complete: false, overall_streak: 1, practice_name: 'Vishnu' })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(h.showInterstitial).toHaveBeenCalled())
  })
})

describe('TodayPage - celebration only from a verified RPC response', () => {
  const singleItem = {
    up: { id: 'up1', current_streak: 0, sequence_position: 0 },
    practice: { id: 5, name: 'Vishnu', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
    logs: [],
  }

  it('shows the celebration modal when submit() resolves with verified data', async () => {
    h.items = [singleItem]
    h.submit.mockResolvedValue({ saved: true, day_complete: true, overall_streak: 1, practice_streak: 1 })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(screen.getByTestId('celebration')).toBeInTheDocument())
  })

  it('never shows the celebration modal when submit() rejects (unverified/failed save)', async () => {
    h.items = [singleItem]
    h.submit.mockRejectedValue(new Error('Save could not be verified'))
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(screen.getByText('Save could not be verified')).toBeInTheDocument())
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument()
    expect(h.showInterstitial).not.toHaveBeenCalled()
  })

  it('never shows the celebration modal when the day is complete but the streak is 0', async () => {
    h.items = [singleItem]
    h.submit.mockResolvedValue({ saved: true, day_complete: true, overall_streak: 0, practice_streak: 1 })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(h.showInterstitial).toHaveBeenCalled())
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument()
  })

  it('never shows the celebration modal for a partial mark (day not complete yet)', async () => {
    h.items = [singleItem]
    h.submit.mockResolvedValue({ saved: true, day_complete: false, overall_streak: 1, practice_streak: 1 })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(h.showInterstitial).toHaveBeenCalled())
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument()
  })
})

describe('TodayPage - Sandhyavandhanam hidden from Add dropdown', () => {
  const sandhyaPractice = { id: 1, name: 'Sandhyavandhanam', icon: '🕉', is_sandhyavandhanam: true, cadence: 'daily' }
  // A non-empty item list keeps the empty-day SuggestedPractices section (which
  // reads from the same mocked catalog) from also rendering "Sandhyavandhanam".
  const openDropdown = () => {
    h.items = [{
      up: { id: 'up-other', current_streak: 0, sequence_position: 0 },
      practice: { id: 9, name: 'Vishnu Sahasranamam', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
      logs: [],
    }]
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Add an anushtanam to track...'))
  }

  it('shows Sandhyavandhanam for a male self-profile (no family member selected)', async () => {
    h.catalog = [sandhyaPractice]
    h.profile = { ...h.profile, gender: 'male' }
    h.selectedMember = null
    openDropdown()
    expect(await screen.findByText('Sandhyavandhanam')).toBeInTheDocument()
  })

  it('hides Sandhyavandhanam for a female profile', async () => {
    h.catalog = [sandhyaPractice]
    h.profile = { ...h.profile, gender: 'female' }
    h.selectedMember = null
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Sandhyavandhanam')).not.toBeInTheDocument()
  })

  it('hides Sandhyavandhanam for a family member boy without upanayanam', async () => {
    h.catalog = [sandhyaPractice]
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: false }
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Sandhyavandhanam')).not.toBeInTheDocument()
  })

  it('shows Sandhyavandhanam for a family member boy with upanayanam done', async () => {
    h.catalog = [sandhyaPractice]
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: true }
    openDropdown()
    expect(await screen.findByText('Sandhyavandhanam')).toBeInTheDocument()
  })
})
