import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ day: null, observanceRow: null }))
vi.mock('../../hooks/usePanchangam', () => ({
  usePanchangam: () => ({ day: h.day, loading: false }),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain, is: () => chain, order: () => chain, limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: h.observanceRow }),
      }
      return chain
    },
  },
}))

import TithiObservanceBanner from '../TithiObservanceBanner'

beforeEach(() => {
  h.day = null
  h.observanceRow = null
  localStorage.clear()
})

describe('TithiObservanceBanner', () => {
  it('renders nothing when there is no panchangam day', () => {
    const { container } = render(<TithiObservanceBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when today\'s thithi has no matching observance', async () => {
    h.day = { thithi: 'Shukla Panchami' }
    h.observanceRow = null
    const { container } = render(<TithiObservanceBanner />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows the banner when today\'s thithi matches an observance', async () => {
    h.day = { thithi: 'Shukla Ekadashi' }
    h.observanceRow = { key: 'shukla_ekadashi', title: 'Ekadashi', message: 'Today is Ekadashi - a day of fasting (vratam) for Vishnu.' }
    render(<TithiObservanceBanner />)
    expect(await screen.findByText('Ekadashi', { selector: '.ms-title' })).toBeInTheDocument()
    expect(screen.getByText(/a day of fasting/)).toBeInTheDocument()
  })

  it('shows identical wording regardless of tradition - no tradition prop or branch', async () => {
    h.day = { thithi: 'Purnima' }
    h.observanceRow = { key: 'monthly_purnima', title: 'Purnima', message: 'Today is Purnima - the full moon day.' }
    render(<TithiObservanceBanner />)
    expect(await screen.findByText('Purnima', { selector: '.ms-title' })).toBeInTheDocument()
  })

  it('dismisses and stays dismissed after a reload (localStorage)', async () => {
    h.day = { thithi: 'Krishna Trayodashi' }
    h.observanceRow = { key: 'krishna_trayodashi', title: 'Trayodashi (Pradosham)', message: 'Today is Trayodashi - Pradosham, the evening twilight period for Shiva worship.' }
    render(<TithiObservanceBanner />)
    await waitFor(() => expect(screen.getByText('Trayodashi (Pradosham)')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Trayodashi (Pradosham)')).not.toBeInTheDocument()

    const { container } = render(<TithiObservanceBanner />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
