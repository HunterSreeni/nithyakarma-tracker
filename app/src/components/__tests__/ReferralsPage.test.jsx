import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ rows: [], rpcError: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: h.rows, error: h.rpcError }) },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { referral_code: 'ref123' } }),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import ReferralsPage from '../ReferralsPage'

beforeEach(() => { h.rows = []; h.rpcError = null })

describe('ReferralsPage', () => {
  it('shows an invite CTA when you have no referrals yet (not an empty list)', async () => {
    render(<ReferralsPage />)
    expect(await screen.findByText('Invite on WhatsApp')).toBeInTheDocument()
    expect(screen.getByText(/Your referrals will appear here/)).toBeInTheDocument()
    expect(screen.getByText(/month ad-free plus a streak freeze/)).toBeInTheDocument()
  })

  it('shows who joined via your referral link, with their join date and both rewards', async () => {
    h.rows = [{ referred_id: 'f1', display_name: 'Ravi Kumar', joined_at: '2026-06-01T00:00:00Z' }]
    render(<ReferralsPage />)
    expect(await screen.findByText('Ravi Kumar')).toBeInTheDocument()
    expect(screen.getByText(/Joined/)).toBeInTheDocument()
    expect(screen.getByText(/\+1 mo.*\+1/)).toBeInTheDocument()
    expect(screen.queryByText('Invite on WhatsApp')).not.toBeInTheDocument()
    expect(screen.getByText('Invite another')).toBeInTheDocument()
  })

  it('shows an error with Retry instead of disguising a real failure as an empty list', async () => {
    h.rpcError = { message: 'permission denied' }
    render(<ReferralsPage />)
    expect(await screen.findByText(/permission/)).toBeInTheDocument()
    expect(screen.queryByText('Your referrals will appear here 🎁')).not.toBeInTheDocument()
  })
})
