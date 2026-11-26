import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ rows: [], rpcError: null, communityEnabled: true, userId: 'u1', calls: [], reportError: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name, args) => {
      h.calls.push([name, args])
      if (name === 'report_leaderboard_name') return Promise.resolve({ data: null, error: h.reportError })
      return Promise.resolve({ data: h.rows, error: h.rpcError })
    },
  },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: h.userId, referral_code: 'ref123', community_enabled: h.communityEnabled } }),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import SabhaPage from '../SabhaPage'
import { queryClient } from '../../lib/queryClient'

const renderPage = () => render(<MemoryRouter><SabhaPage /></MemoryRouter>)

beforeEach(() => {
  queryClient.clear(); h.rows = []; h.rpcError = null; h.communityEnabled = true; h.userId = 'u1'
  h.calls = []; h.reportError = null; localStorage.clear()
})

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

// Apple guideline 1.2: report and hide (block) other people's Sabha names.
describe('SabhaPage - report and hide a name', () => {
  const board = () => [
    { subject_id: 'me', display_name: 'Me', tier: 'Shishya', score: 5, streak: 3, is_me: true },
    { subject_id: 'x1', display_name: 'Rude Name', tier: 'Yogi', score: 4, streak: 9, is_me: false },
  ]

  it('offers the option on rows of other people only, never on your own', async () => {
    h.rows = board()
    renderPage()
    expect(await screen.findByRole('button', { name: 'Report or hide Rude Name' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Report or hide Me/ })).not.toBeInTheDocument()
  })

  it('Report name sends the row id to the server and hides it for the reporter', async () => {
    h.rows = board()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Report or hide Rude Name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Report name' }))
    expect(await screen.findByText("Reported. Thank you - we'll review it.")).toBeInTheDocument()
    expect(h.calls).toContainEqual(['report_leaderboard_name', { p_subject_id: 'x1' }])
    expect(screen.queryByText('Rude Name')).not.toBeInTheDocument()
    expect(screen.getByText('Me (You)')).toBeInTheDocument()
  })

  it('hiding keeps the real ranks and drops the Hall banner instead of promoting someone else', async () => {
    h.rows = [
      { subject_id: 'x1', display_name: 'Top Name', tier: 'Yogi', score: 9, streak: 9, is_me: false },
      { subject_id: 'me', display_name: 'Me', tier: 'Shishya', score: 5, streak: 3, is_me: true },
    ]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Report or hide Top Name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide from my Sabha' }))
    await waitFor(() => expect(screen.queryByText('Top Name')).not.toBeInTheDocument())
    expect(screen.queryByText(/Hall of the/)).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('a failed report shows the error and keeps the name', async () => {
    h.rows = board()
    h.reportError = { message: 'Too many reports today. Please try again tomorrow.' }
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Report or hide Rude Name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Report name' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getAllByText('Rude Name').length).toBeGreaterThan(0)
  })

  it('Hide works without a report, survives a reload, and Show brings it back', async () => {
    h.rows = board()
    const first = renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Report or hide Rude Name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide from my Sabha' }))
    await waitFor(() => expect(screen.queryByText('Rude Name')).not.toBeInTheDocument())
    expect(h.calls.some(([n]) => n === 'report_leaderboard_name')).toBe(false)
    first.unmount()

    renderPage()
    expect(await screen.findByText(/Hidden names: 1/)).toBeInTheDocument()
    expect(screen.queryByText('Rude Name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(await screen.findByText('Rude Name')).toBeInTheDocument()
  })
})
