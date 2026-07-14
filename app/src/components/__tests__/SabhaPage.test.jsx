import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({ rows: [], rpcError: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: h.rows, error: h.rpcError }) },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { referral_code: 'ref123' } }),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import SabhaPage from '../SabhaPage'

beforeEach(() => { h.rows = []; h.rpcError = null })

describe('SabhaPage - Friends tab', () => {
  it('shows an invite CTA when you have no friends yet (not a lonely one-person board)', async () => {
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Jijnasu', score: 3, streak: 3, is_me: true }]
    render(<SabhaPage />)
    fireEvent.click(screen.getByText('Friends'))
    expect(await screen.findByText('Invite on WhatsApp')).toBeInTheDocument()
    expect(screen.getByText(/Your Sabha grows with friends/)).toBeInTheDocument()
  })

  it('shows the friends leaderboard once you have connections', async () => {
    h.rows = [
      { subject_id: 'me', display_name: 'Me', tier: 'Sadhaka', score: 10, streak: 5, is_me: true },
      { subject_id: 'f1', display_name: 'Ravi Kumar', tier: 'Jijnasu', score: 4, streak: 2, is_me: false },
    ]
    render(<SabhaPage />)
    fireEvent.click(screen.getByText('Friends'))
    expect(await screen.findByText('Ravi Kumar')).toBeInTheDocument()
    expect(screen.queryByText('Invite on WhatsApp')).not.toBeInTheDocument()
  })

  it('the global Week board is unaffected (no invite CTA there)', async () => {
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Jijnasu', score: 3, streak: 3, is_me: true }]
    render(<SabhaPage />)
    expect(await screen.findByText('Me (You)')).toBeInTheDocument()
    expect(screen.queryByText('Invite on WhatsApp')).not.toBeInTheDocument()
  })
})

describe('SabhaPage - RPC failure', () => {
  it('shows an error with Retry instead of disguising a real failure as an empty leaderboard', async () => {
    h.rpcError = { message: 'permission denied' }
    render(<SabhaPage />)
    expect(await screen.findByText(/permission/)).toBeInTheDocument()
    expect(screen.queryByText('No entries yet. Complete an anushtanam to appear here!')).not.toBeInTheDocument()
    h.rpcError = null
    h.rows = [{ subject_id: 'me', display_name: 'Me', tier: 'Jijnasu', score: 3, streak: 3, is_me: true }]
    fireEvent.click(screen.getByText('Retry'))
    expect(await screen.findByText('Me (You)')).toBeInTheDocument()
  })
})
