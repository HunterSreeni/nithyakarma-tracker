import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { localDateString } from '../../utils/cadence'

// Child components pull in ads/router/localStorage - not under test here.
vi.mock('../ProfileSwitcher', () => ({ default: () => null }))
vi.mock('../CelebrationModal', () => ({
  default: ({ data, onClose }) => (
    data ? <div data-testid="celebration"><button onClick={onClose}>close-celebration</button>{data.practice_streak}</div> : null
  ),
}))
vi.mock('../TierUpModal', () => ({
  default: ({ tier }) => <div data-testid="tier-up">{tier}</div>,
}))
vi.mock('../GuidedTour', () => ({ default: () => null }))
vi.mock('../PanchangamBox', () => ({ default: () => null }))
vi.mock('../MonthlySpecialBanner', () => ({ default: () => null }))
vi.mock('../ObservanceBanner', () => ({ default: () => null }))

const h = vi.hoisted(() => ({
  items: [], catalog: [], addPractice: vi.fn(),
  submit: vi.fn(), showInterstitial: vi.fn().mockResolvedValue(false),
  profile: { gender: 'male', display_name: 'Test User', current_streak: 0, best_streak: 0, freeze_credits: 2 },
  selectedMember: null,
  refresh: vi.fn(), rpc: vi.fn(), yesterdayLogs: [],
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
    refresh: h.refresh,
  }),
}))
// AddPracticeDropdown + SuggestedPractices fetch practices on mount; the
// yesterday-sandhya panel fetches practice_logs and then calls rpc() directly
// (the chain is thenable so a query with no terminal .order() still resolves).
vi.mock('../../lib/supabase', () => {
  const chain = (table) => {
    const c = {
      select: () => c, eq: () => c, in: () => c,
      order: () => Promise.resolve({ data: h.catalog }),
      then: (resolve) => resolve({ data: table === 'practice_logs' ? h.yesterdayLogs : h.catalog }),
    }
    return c
  }
  return { supabase: { from: (table) => chain(table), rpc: (...a) => h.rpc(...a) } }
})

import TodayPage from '../TodayPage'
import { queryClient } from '../../lib/queryClient'

const sandhyaItem = (slots) => ({
  up: { id: 'up-s', current_streak: 0, sequence_position: 0 },
  practice: { id: 1, name: 'Sandhyavandhanam', icon: '🕉', is_sandhyavandhanam: true, cadence: 'daily' },
  logs: slots.map(s => ({ slot: s })),
})

const rudramItem = (slots) => ({
  up: { id: 'up-r', current_streak: 0, sequence_position: 0 },
  practice: { id: 9, name: 'Sri Rudram', icon: '🔱', is_sri_rudram: true, cadence: 'daily', weekday: 1, target_count: null },
  logs: slots.map(s => ({ slot: s })),
})

beforeEach(() => {
  queryClient.clear()
  h.items = []; h.catalog = []; h.yesterdayLogs = []
  h.addPractice.mockClear(); h.submit.mockReset(); h.showInterstitial.mockClear()
  h.refresh.mockClear(); h.rpc.mockReset()
  h.profile = { gender: 'male', display_name: 'Test User', current_streak: 0, best_streak: 0, freeze_credits: 2 }
  h.selectedMember = null
})

describe('TodayPage - punya and tier follow the selected subject', () => {
  it("shows the parent's own punya and tier when no family member is selected", () => {
    h.items = [sandhyaItem([])]
    h.profile = { ...h.profile, punya: 150 }
    h.selectedMember = null
    render(<TodayPage />)
    expect(screen.getByText('150 punya')).toBeInTheDocument()
    expect(screen.getByText('Sadhaka')).toBeInTheDocument()
  })

  it("shows the selected family member's own punya and tier, not the parent's", () => {
    h.items = [sandhyaItem([])]
    h.profile = { ...h.profile, punya: 150 }
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: true, punya: 5, best_streak: 0, freeze_credits: 1 }
    render(<TodayPage />)
    expect(screen.getByText('5 punya')).toBeInTheDocument()
    expect(screen.getByText('Shishya')).toBeInTheDocument()
    expect(screen.queryByText('150 punya')).not.toBeInTheDocument()
    expect(screen.queryByText('Sadhaka')).not.toBeInTheDocument()
  })
})

describe('TodayPage - Sandhyavandhanam UX', () => {
  it('marking a single slot completes the day (2026-07-20: 1 of 3 is enough)', () => {
    h.items = [sandhyaItem(['morning'])]
    render(<TodayPage />)
    expect(screen.getByText('1 of 3 sandhyas done · streak kept')).toBeInTheDocument()
    expect(screen.getByText('1 anushtanam done today. Wonderful, all done!')).toBeInTheDocument()
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
    expect(screen.getByText('1 anushtanam done today. Wonderful, all done!')).toBeInTheDocument()
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

  it('offers backfill or freeze use throughout the catch-up day when a freeze is available', () => {
    h.items = [sandhyaItem([])]
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    h.profile = { ...h.profile, current_streak: 4, last_complete_date: localDateString(twoDaysAgo), freeze_credits: 1 }
    render(<TodayPage />)
    expect(screen.getByRole('status')).toHaveTextContent(/Backfill one of yesterday's sandhyas/)
    expect(screen.getByRole('status')).toHaveTextContent(/mark one anushtanam today to use a freeze/)
  })

  it('still offers the full backfill window with no freeze and explains that today alone restarts', () => {
    h.items = [sandhyaItem([])]
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    h.profile = { ...h.profile, current_streak: 4, last_complete_date: localDateString(twoDaysAgo), freeze_credits: 0 }
    render(<TodayPage />)
    expect(screen.getByRole('status')).toHaveTextContent(/Backfill one of yesterday's sandhyas before today ends/)
    expect(screen.getByRole('status')).toHaveTextContent(/Marking only today will restart it/)
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

describe('TodayPage - any one practice completes the day (2026-08-02)', () => {
  const doneItem = {
    up: { id: 'up-done', current_streak: 1, sequence_position: 0 },
    practice: { id: 1, name: 'Already Done', is_sandhyavandhanam: false, cadence: 'daily', affects_streak: true },
    logs: [{ counts_toward_streak: true }],
  }
  const undoneItem = {
    up: { id: 'up-undone', current_streak: 0, sequence_position: 0 },
    practice: { id: 5, name: 'Vishnu', is_sandhyavandhanam: false, cadence: 'daily', affects_streak: true },
    logs: [],
  }

  it('does not re-show the celebration on a second mark once the day was already complete', async () => {
    h.items = [doneItem, undoneItem]
    h.submit.mockResolvedValue({ saved: true, day_complete: true, overall_streak: 5, practice_streak: 1 })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(h.showInterstitial).toHaveBeenCalled())
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument()
  })
})

describe('TodayPage - tier-up celebration', () => {
  const singleItem = {
    up: { id: 'up1', current_streak: 0, sequence_position: 0 },
    practice: { id: 5, name: 'Vishnu', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
    logs: [],
  }

  it('shows the tier-up modal when a mark crosses a tier boundary', async () => {
    h.items = [singleItem]
    h.submit.mockResolvedValue({
      saved: true, day_complete: false, overall_streak: 0, practice_streak: 1,
      tier_up: true, tier: 'Sadhaka',
    })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(screen.getByTestId('tier-up')).toHaveTextContent('Sadhaka'))
  })

  it('waits for the streak celebration to close before showing a simultaneous tier-up', async () => {
    h.items = [singleItem]
    h.submit.mockResolvedValue({
      saved: true, day_complete: true, overall_streak: 1, practice_streak: 1,
      tier_up: true, tier: 'Yogi',
    })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Mark Done'))
    await waitFor(() => expect(screen.getByTestId('celebration')).toBeInTheDocument())
    expect(screen.queryByTestId('tier-up')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('close-celebration'))
    await waitFor(() => expect(screen.getByTestId('tier-up')).toHaveTextContent('Yogi'))
  })
})

describe('TodayPage - Gayatri count popup on Sandhyavandhanam slots', () => {
  it('clicking a slot opens a count prompt instead of marking immediately', () => {
    h.items = [sandhyaItem([])]
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Morning'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Prathakala Gayatri Count')).toBeInTheDocument()
    expect(h.submit).not.toHaveBeenCalled()
  })

  it('confirming the count submits it as the log count for that slot', async () => {
    h.items = [sandhyaItem([])]
    h.submit.mockResolvedValue({ saved: true, day_complete: false, overall_streak: 1, practice_name: 'Sandhyavandhanam' })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Morning'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '28' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(h.submit).toHaveBeenCalledWith('up-s', { slot: 'morning', count: 28 }))
  })

  it('cancelling the prompt does not submit anything', () => {
    h.items = [sandhyaItem([])]
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Morning'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.submit).not.toHaveBeenCalled()
  })
})

describe('TodayPage - Sri Rudram 3-slot marking (2026-08-11)', () => {
  it('shows all 3 slot options and the "traditionally Mondays" info hint, not a gate', () => {
    h.items = [rudramItem([])]
    render(<TodayPage />)
    expect(screen.getByText('Namakam')).toBeInTheDocument()
    expect(screen.getByText('Chamakam')).toBeInTheDocument()
    expect(screen.getByText('Both')).toBeInTheDocument()
    expect(screen.getByText(/traditionally Mondays/)).toBeInTheDocument()
  })

  it('clicking a slot marks it directly, with no count prompt (unlike Sandhya)', async () => {
    h.items = [rudramItem([])]
    h.submit.mockResolvedValue({ saved: true, day_complete: true, overall_streak: 1, practice_name: 'Sri Rudram' })
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Namakam'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(h.submit).toHaveBeenCalledWith('up-r', { slot: 'namakam', count: null }))
  })

  it('any 1 of 3 slots marks the day complete, no "Mark Done" button shown', () => {
    h.items = [rudramItem(['chamakam'])]
    render(<TodayPage />)
    expect(screen.getByText('1 anushtanam done today. Wonderful, all done!')).toBeInTheDocument()
    expect(screen.queryByText('Mark Done')).not.toBeInTheDocument()
  })

  it('an already-marked slot is shown done and disabled', () => {
    h.items = [rudramItem(['both'])]
    render(<TodayPage />)
    expect(screen.getByText('Both').closest('button')).toBeDisabled()
    expect(screen.getByText('Namakam').closest('button')).not.toBeDisabled()
  })
})

describe('TodayPage - Samidhadhanam hidden from Add dropdown', () => {
  const samidhaPractice = { id: 20, name: 'Samidhadhanam', icon: '🔥', is_sandhyavandhanam: false, requires_brahmachari: true, cadence: 'daily' }
  const openDropdown = () => {
    h.items = [{
      up: { id: 'up-other', current_streak: 0, sequence_position: 0 },
      practice: { id: 9, name: 'Vishnu Sahasranamam', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
      logs: [],
    }]
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Add an anushtanam to track...'))
  }

  it('shows Samidhadhanam for an unmarried male self-profile', async () => {
    h.catalog = [samidhaPractice]
    h.profile = { ...h.profile, gender: 'male', is_married: false }
    h.selectedMember = null
    openDropdown()
    expect(await screen.findByText('Samidhadhanam')).toBeInTheDocument()
  })

  it('hides Samidhadhanam for a married male self-profile', async () => {
    h.catalog = [samidhaPractice]
    h.profile = { ...h.profile, gender: 'male', is_married: true }
    h.selectedMember = null
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Samidhadhanam')).not.toBeInTheDocument()
  })

  it('hides Samidhadhanam for a female profile', async () => {
    h.catalog = [samidhaPractice]
    h.profile = { ...h.profile, gender: 'female' }
    h.selectedMember = null
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Samidhadhanam')).not.toBeInTheDocument()
  })

  it('shows Samidhadhanam for a family member boy with upanayanam done', async () => {
    h.catalog = [samidhaPractice]
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: true }
    openDropdown()
    expect(await screen.findByText('Samidhadhanam')).toBeInTheDocument()
  })

  it('hides Samidhadhanam for a family member boy without upanayanam', async () => {
    h.catalog = [samidhaPractice]
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: false }
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Samidhadhanam')).not.toBeInTheDocument()
  })
})

describe('TodayPage - Brahmayagnam hidden from Add dropdown', () => {
  const brahmayagnamPractice = { id: 21, name: 'Brahmayagnam', icon: '📖', is_sandhyavandhanam: false, requires_grihastha: true, cadence: 'daily' }
  const openDropdown = () => {
    h.items = [{
      up: { id: 'up-other', current_streak: 0, sequence_position: 0 },
      practice: { id: 9, name: 'Vishnu Sahasranamam', icon: '🕉', is_sandhyavandhanam: false, cadence: 'daily' },
      logs: [],
    }]
    render(<TodayPage />)
    fireEvent.click(screen.getByText('Add an anushtanam to track...'))
  }

  it('shows Brahmayagnam for a married male self-profile', async () => {
    h.catalog = [brahmayagnamPractice]
    h.profile = { ...h.profile, gender: 'male', is_married: true }
    h.selectedMember = null
    openDropdown()
    expect(await screen.findByText('Brahmayagnam')).toBeInTheDocument()
  })

  it('hides Brahmayagnam for an unmarried male self-profile', async () => {
    h.catalog = [brahmayagnamPractice]
    h.profile = { ...h.profile, gender: 'male', is_married: false }
    h.selectedMember = null
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Brahmayagnam')).not.toBeInTheDocument()
  })

  it('hides Brahmayagnam for a female profile, even if married', async () => {
    h.catalog = [brahmayagnamPractice]
    h.profile = { ...h.profile, gender: 'female', is_married: true }
    h.selectedMember = null
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Brahmayagnam')).not.toBeInTheDocument()
  })

  it('hides Brahmayagnam for any family member - a child can never be married', async () => {
    h.catalog = [brahmayagnamPractice]
    h.selectedMember = { id: 'fm1', gender: 'male', upanayanam_done: true }
    openDropdown()
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
    expect(screen.queryByText('Brahmayagnam')).not.toBeInTheDocument()
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

describe('TodayPage - Yesterday sandhya catch-up', () => {
  const yesterday = localDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  const openYesterdayPanel = async () => {
    fireEvent.click(screen.getByText('Missed a sandhya yesterday?'))
    await screen.findByText(/Full punya|already marked/)
  }
  const yesterdayPanel = () => screen.getByText('Missed a sandhya yesterday?').closest('.yesterday-sandhya')

  it('opens to all 3 slots available when nothing was logged yesterday', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = []
    render(<TodayPage />)
    await openYesterdayPanel()
    const panel = within(yesterdayPanel())
    expect(panel.getByText('Morning')).toBeInTheDocument()
    expect(panel.getByText('Noon')).toBeInTheDocument()
    expect(panel.getByText('Evening')).toBeInTheDocument()
  })

  it('shows an already-marked message and no slots when all 3 were already backdated', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = [{ slot: 'morning' }, { slot: 'afternoon' }, { slot: 'evening' }]
    render(<TodayPage />)
    await openYesterdayPanel()
    expect(screen.getByText("All 3 of yesterday's sandhyas are already marked.")).toBeInTheDocument()
  })

  it('clicking a slot opens a Gayatri count prompt instead of marking immediately', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = []
    render(<TodayPage />)
    await openYesterdayPanel()
    fireEvent.click(within(yesterdayPanel()).getByText('Morning'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Prathakala Gayatri Count')).toBeInTheDocument()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('confirming the count calls the RPC backdated and streak-counting with that count, shows the full punya note, and refreshes the card', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = []
    h.rpc.mockResolvedValue({
      data: { saved: true, backdated: true, punya_awarded: 5, overall_streak: 2 }, error: null,
    })
    render(<TodayPage />)
    await openYesterdayPanel()
    fireEvent.click(within(yesterdayPanel()).getByText('Morning'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '28' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('submit_yesterday_sandhya', {
      p_user_practice_id: 'up-s', p_slot: 'morning', p_count: 28,
      p_local_date: yesterday,
    }))
    await screen.findByText('+5 punya · streak is now 2 days')
    expect(h.refresh).toHaveBeenCalled()
  })

  it('cancelling the prompt does not submit anything', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = []
    render(<TodayPage />)
    await openYesterdayPanel()
    fireEvent.click(within(yesterdayPanel()).getByText('Morning'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('explains when a backfill refunds a freeze previously spent for yesterday', async () => {
    h.items = [sandhyaItem([])]
    h.rpc.mockResolvedValue({
      data: {
        saved: true, backdated: true, punya_awarded: 5, overall_streak: 6,
        freeze_refunded: true,
      }, error: null,
    })
    render(<TodayPage />)
    await openYesterdayPanel()
    fireEvent.click(within(yesterdayPanel()).getByText('Morning'))
    fireEvent.click(screen.getByText('Save'))
    await screen.findByText('+5 punya · streak is now 6 days · freeze refunded')
  })

  it('shows an inline error and leaves the slot markable when the RPC fails', async () => {
    h.items = [sandhyaItem([])]
    h.yesterdayLogs = []
    h.rpc.mockResolvedValue({ data: null, error: { message: 'network down' } })
    render(<TodayPage />)
    await openYesterdayPanel()
    fireEvent.click(within(yesterdayPanel()).getByText('Morning'))
    fireEvent.click(screen.getByText('Save'))
    await screen.findByText('network down')
    expect(h.refresh).not.toHaveBeenCalled()
    expect(within(yesterdayPanel()).getByText('Morning').closest('button')).not.toBeDisabled()
  })
})
