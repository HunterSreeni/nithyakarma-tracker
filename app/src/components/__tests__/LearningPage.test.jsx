import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../CelebrationModal', () => ({
  default: ({ data }) => (data ? <div data-testid="celebration">{data.overall_streak}</div> : null),
}))

const VERSE = { id: 'doha-1', type: 'doha', english: 'english text', malayalam: 'malayalam text', sanskrit: 'sanskrit text' }

const h = vi.hoisted(() => ({
  items: [], submit: vi.fn(), addPractice: vi.fn(),
  verses: [], learned: new Set(), markLearned: vi.fn(),
  practiceRow: { id: 42 }, userPracticeRow: { id: 'up-new' },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'owner1' } },
    profile: { display_name: 'Test User' },
    selectedMember: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('../../hooks/useToday', () => ({
  useToday: () => ({ items: h.items, submit: h.submit, addPractice: h.addPractice }),
}))
vi.mock('../../hooks/useLearning', () => ({
  useLearning: () => ({ verses: h.verses, learned: h.learned, loading: false, error: '', markLearned: h.markLearned }),
}))
vi.mock('../../lib/supabase', () => {
  const single = (row) => ({ single: () => Promise.resolve({ data: row }) })
  return {
    supabase: {
      from: vi.fn((table) => {
        const c = {
          select: () => c, eq: () => c, is: () => c,
          ...single(table === 'practices' ? h.practiceRow : h.userPracticeRow),
        }
        return c
      }),
    },
  }
})

import LearningPage from '../LearningPage'

beforeEach(() => {
  vi.clearAllMocks()
  h.items = []
  h.verses = [VERSE]
  h.learned = new Set()
  h.markLearned.mockResolvedValue(true)
  h.submit.mockResolvedValue({ saved: true, overall_streak: 5, day_complete: true })
})

describe('LearningPage - language switch', () => {
  it('shows English by default and switches script on language select', () => {
    render(<LearningPage />)
    expect(screen.getByText('english text')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Malayalam'))
    expect(screen.getByText('malayalam text')).toBeInTheDocument()
    expect(screen.queryByText('english text')).not.toBeInTheDocument()
  })

  it('shows the learned/total progress', () => {
    h.verses = [VERSE, { ...VERSE, id: 'doha-2' }]
    h.learned = new Set(['doha-1'])
    render(<LearningPage />)
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })
})

describe('LearningPage - marking a verse learned wires the dashboard', () => {
  it('auto-adds the practice when untracked, then submits and celebrates', async () => {
    h.items = []
    render(<LearningPage />)
    fireEvent.click(screen.getByText('Mark Learned'))
    await waitFor(() => expect(h.addPractice).toHaveBeenCalledWith(42))
    await waitFor(() => expect(h.submit).toHaveBeenCalledWith('up-new', { awardStreak: false }))
    expect(await screen.findByTestId('celebration')).toHaveTextContent('5')
  })

  it('submits against the existing tracked practice without re-adding it', async () => {
    h.items = [{
      up: { id: 'up-existing' },
      practice: { slug: 'hanuman-chalisa', cadence: 'daily', is_sandhyavandhanam: false },
      logs: [],
    }]
    render(<LearningPage />)
    fireEvent.click(screen.getByText('Mark Learned'))
    await waitFor(() => expect(h.submit).toHaveBeenCalledWith('up-existing', { awardStreak: false }))
    expect(h.addPractice).not.toHaveBeenCalled()
  })

  it('skips submit when the practice is already done today (avoids a duplicate log)', async () => {
    h.items = [{
      up: { id: 'up-existing' },
      practice: { slug: 'hanuman-chalisa', cadence: 'daily', is_sandhyavandhanam: false },
      logs: [{ slot: null }],
    }]
    render(<LearningPage />)
    fireEvent.click(screen.getByText('Mark Learned'))
    await waitFor(() => expect(h.markLearned).toHaveBeenCalled())
    expect(h.submit).not.toHaveBeenCalled()
  })

  it('does not touch the dashboard when the verse was already learned', async () => {
    h.markLearned.mockResolvedValue(false)
    render(<LearningPage />)
    fireEvent.click(screen.getByText('Mark Learned'))
    await waitFor(() => expect(h.markLearned).toHaveBeenCalled())
    expect(h.addPractice).not.toHaveBeenCalled()
    expect(h.submit).not.toHaveBeenCalled()
  })
})
