import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ ups: [], logs: [], failNext: false }))

function chain(resolveValue, shouldFail) {
  const b = {
    select: () => b, eq: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
    then: (resolve, reject) => {
      if (shouldFail) return Promise.reject(new Error('network error')).then(resolve, reject)
      return Promise.resolve(resolveValue).then(resolve, reject)
    },
  }
  return b
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'user_practices') return chain({ data: h.ups }, h.failNext)
      if (table === 'practice_logs') return chain({ data: h.logs }, false)
      return chain({ data: [] }, false)
    }),
  },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } }, selectedMember: null,
    profile: { display_name: 'Test User' }, familyMembers: [], setSelectedMember: vi.fn(),
  }),
}))

import HistoryPage from '../HistoryPage'

function renderHistoryPage() {
  return render(<MemoryRouter><HistoryPage /></MemoryRouter>)
}

beforeEach(() => {
  h.ups = []; h.logs = []; h.failNext = false
})

describe('HistoryPage', () => {
  it('shows an empty note when there is nothing logged', async () => {
    renderHistoryPage()
    expect(await screen.findByText('No anushtanams logged yet.')).toBeInTheDocument()
  })

  it('groups logs by date once loaded', async () => {
    h.ups = [{ id: 'up1', practice: { name: 'Vishnu Sahasranamam', icon: '🕉️', is_sandhyavandhanam: false } }]
    h.logs = [{ user_practice_id: 'up1', log_date: '2026-07-10', slot: null }]
    renderHistoryPage()
    expect(await screen.findByText(/Vishnu Sahasranamam/)).toBeInTheDocument()
  })

  it('shows an error with Retry instead of a silent stuck spinner when the fetch fails, and recovers on retry', async () => {
    h.failNext = true
    renderHistoryPage()
    expect(await screen.findByText(/Couldn't reach the server|Something went wrong/)).toBeInTheDocument()
    h.ups = [{ id: 'up1', practice: { name: 'Hanuman Chalisa', icon: '🐒', is_sandhyavandhanam: false } }]
    h.logs = [{ user_practice_id: 'up1', log_date: '2026-07-10', slot: null }]
    h.failNext = false
    fireEvent.click(screen.getByText('Retry'))
    await waitFor(() => expect(screen.getByText(/Hanuman Chalisa/)).toBeInTheDocument())
  })
})
