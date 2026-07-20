import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ day: null, specialRow: null }))
vi.mock('../../hooks/usePanchangam', () => ({
  usePanchangam: () => ({ day: h.day, loading: false }),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: h.specialRow }),
        }),
      }),
    }),
  },
}))

import MonthlySpecialBanner from '../MonthlySpecialBanner'

function renderIt() {
  return render(<MemoryRouter><MonthlySpecialBanner /></MemoryRouter>)
}

beforeEach(() => {
  h.day = null
  h.specialRow = null
  localStorage.clear()
})

describe('MonthlySpecialBanner', () => {
  it('renders nothing when there is no panchangam day', () => {
    const { container } = renderIt()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the current month has no special', async () => {
    h.day = { malayalam_month: 'Chingam' }
    h.specialRow = null
    const { container } = renderIt()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows the nudge and links to the special route when a match exists', async () => {
    h.day = { malayalam_month: 'Karkidakam' }
    h.specialRow = { malayalam_month: 'Karkidakam', title: 'Ramayana Masam', subtitle: 'Read along', route: '/ramayana-masam' }
    renderIt()
    await waitFor(() => expect(screen.getByText('Ramayana Masam')).toBeInTheDocument())
    expect(screen.getByText('Ramayana Masam').closest('a')).toHaveAttribute('href', '/ramayana-masam')
  })

  it('dismisses and stays dismissed after a reload (localStorage)', async () => {
    h.day = { malayalam_month: 'Karkidakam' }
    h.specialRow = { malayalam_month: 'Karkidakam', title: 'Ramayana Masam', subtitle: 'Read along', route: '/ramayana-masam' }
    renderIt()
    await waitFor(() => expect(screen.getByText('Ramayana Masam')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Ramayana Masam')).not.toBeInTheDocument()

    const { container } = renderIt()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
