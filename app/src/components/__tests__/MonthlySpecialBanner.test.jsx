import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ day: null, specialRow: null, tradition: undefined }))
vi.mock('../../hooks/usePanchangam', () => ({
  usePanchangam: () => ({ day: h.day, loading: false }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { panchangam_tradition: h.tradition } }),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: h.specialRow }),
          }),
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
  h.tradition = undefined
  localStorage.clear()
})

describe('MonthlySpecialBanner', () => {
  it('renders nothing when there is no panchangam day', () => {
    const { container } = renderIt()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the current month has no special', async () => {
    h.day = { tamil_month: 'Vaikasi' }
    h.specialRow = null
    const { container } = renderIt()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows the nudge and links to the special route when a match exists (default tamil tradition)', async () => {
    h.day = { tamil_month: 'Margazhi' }
    h.specialRow = { calendar: 'tamil', month: 'Margazhi', title: 'Margazhi', subtitle: 'Thiruppavai season', route: '/thiruppavai' }
    renderIt()
    await waitFor(() => expect(screen.getByText('Margazhi', { selector: '.ms-title' })).toBeInTheDocument())
    expect(screen.getByText('Margazhi', { selector: '.ms-title' }).closest('a')).toHaveAttribute('href', '/thiruppavai')
  })

  it('shows the malayalam special when panchangam_tradition is malayalam', async () => {
    h.tradition = 'malayalam'
    h.day = { malayalam_month: 'Karkidakam', tamil_month: 'Aadi' }
    h.specialRow = { calendar: 'malayalam', month: 'Karkidakam', title: 'Ramayana Masam', subtitle: 'Read along', route: '/ramayana-masam' }
    renderIt()
    await waitFor(() => expect(screen.getByText('Ramayana Masam')).toBeInTheDocument())
    expect(screen.getByText('Ramayana Masam').closest('a')).toHaveAttribute('href', '/ramayana-masam')
  })

  it('renders an info-only banner (no link) when the special has no route', async () => {
    h.day = { tamil_month: 'Purattasi' }
    h.specialRow = { calendar: 'tamil', month: 'Purattasi', title: 'Purattasi Sani', subtitle: 'Vishnu worship', route: null }
    renderIt()
    await waitFor(() => expect(screen.getByText('Purattasi Sani', { selector: '.ms-title' })).toBeInTheDocument())
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('dismisses and stays dismissed after a reload (localStorage)', async () => {
    h.day = { tamil_month: 'Margazhi' }
    h.specialRow = { calendar: 'tamil', month: 'Margazhi', title: 'Margazhi', subtitle: 'Thiruppavai season', route: '/thiruppavai' }
    renderIt()
    await waitFor(() => expect(screen.getByText('Margazhi', { selector: '.ms-title' })).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Margazhi', { selector: '.ms-title' })).not.toBeInTheDocument()

    const { container } = renderIt()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
