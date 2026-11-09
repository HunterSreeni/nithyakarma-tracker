import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ rows: [], rpcError: null, communityEnabled: true, userId: 'u1' }))
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: h.rows, error: h.rpcError }) },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: h.userId, referral_code: 'ref123', community_enabled: h.communityEnabled } }),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import SabhaPage from '../SabhaPage'
import { queryClient } from '../../lib/queryClient'

const renderPage = () => render(<MemoryRouter><SabhaPage /></MemoryRouter>)

beforeEach(() => { queryClient.clear(); h.rows = []; h.rpcError = null; h.communityEnabled = true; h.userId = 'u1' })

describe('SabhaPage - community opt-in gate', () => {
  it('shows an enable-community prompt instead of the leaderboard when community_enabled is false', async () => {
    h.communityEnabled = false
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Shishya', score: 3, streak: 3, is_me: true }]
    renderPage()
    expect(await screen.findByText('Community is hidden')).toBeInTheDocument()
    expect(screen.queryByText('Me (You)')).not.toBeInTheDocument()
  })
})

describe('SabhaPage - leaderboard', () => {
  it('the global Week board renders rows', async () => {
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Shishya', score: 3, streak: 3, is_me: true }]
    renderPage()
    expect(await screen.findByText('Me (You)')).toBeInTheDocument()
  })
})

describe('SabhaPage - RPC failure', () => {
  it('shows an error with Retry instead of disguising a real failure as an empty leaderboard', async () => {
    h.rpcError = { message: 'permission denied' }
    renderPage()
    expect(await screen.findByText(/permission/)).toBeInTheDocument()
    expect(screen.queryByText('No entries yet. Complete an anushtanam to appear here!')).not.toBeInTheDocument()
    h.rpcError = null
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Shishya', score: 3, streak: 3, is_me: true }]
    fireEvent.click(screen.getByText('Retry'))
    expect(await screen.findByText('Me (You)')).toBeInTheDocument()
  })
})

// Shared device: the board is per-viewer, so a second account must never be
// served the first account's cached rows within the 30s staleTime.
describe('SabhaPage - per-account cache', () => {
  it('a different signed-in account fetches its own board instead of reusing the cached one', async () => {
    h.rows = [{ subject_id: 'a', display_name: 'Alpha', tier: 'Shishya', score: 3, streak: 3, is_me: true }]
    const first = renderPage()
    expect(await screen.findByText('Alpha (You)')).toBeInTheDocument()
    first.unmount()
    h.userId = 'u2'
    h.rows = [{ subject_id: 'b', display_name: 'Beta', tier: 'Shishya', score: 1, streak: 1, is_me: true }]
    renderPage()
    expect(await screen.findByText('Beta (You)')).toBeInTheDocument()
    expect(screen.queryByText('Alpha (You)')).not.toBeInTheDocument()
  })
})
