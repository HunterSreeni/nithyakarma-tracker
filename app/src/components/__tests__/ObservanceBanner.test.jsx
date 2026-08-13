import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({ days: [], rules: [] }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => table === 'panchangam_days'
        ? { in: () => Promise.resolve({ data: h.days, error: null }) }
        : Promise.resolve({ data: h.rules, error: null }),
    }),
  },
}))

import ObservanceBanner from '../ObservanceBanner'

const baseDay = {
  date: '2026-08-12', thithi: 'Amavasya', tamil_month: 'Aadi', tamil_day: 27,
  malayalam_month: 'Karkidakam', malayalam_day: 27, nakshatra: 'Ashlesha',
}
const rule = (overrides) => ({
  key: 'monthly_amavasya', category: 'tharpanam', title: 'Amavasya Tharpanam',
  message: 'Today is Amavasya - a day for ancestor tharpanam.', match_thithi: 'Amavasya',
  match_tamil_month: null, match_tamil_day: null, match_malayalam_month: null,
  match_malayalam_day: null, match_nakshatra: null, day_offset: 0, priority: 0,
  advance_notify: false, ...overrides,
})

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(<QueryClientProvider client={client}><ObservanceBanner /></QueryClientProvider>)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-12T08:00:00+05:30'))
  h.days = []
  h.rules = []
  localStorage.clear()
})

afterEach(() => vi.useRealTimers())

describe('ObservanceBanner', () => {
  it('renders nothing when no rule matches', async () => {
    h.days = [{ ...baseDay, thithi: 'Shukla Panchami' }]
    h.rules = [rule({ match_thithi: 'Purnima' })]
    const { container } = renderBanner()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows Amavasya/Tharpanam occasions', async () => {
    h.days = [baseDay]
    h.rules = [rule({})]
    renderBanner()
    expect(await screen.findByText('Amavasya Tharpanam')).toBeInTheDocument()
    expect(screen.getByText(/ancestor tharpanam/)).toBeInTheDocument()
  })

  it('uses the named highest-priority occasion instead of a generic same-category rule', async () => {
    h.days = [baseDay]
    h.rules = [
      rule({}),
      rule({ key: 'karkidaka_vaavu', title: 'Karkidaka Vaavu', priority: 10,
        match_malayalam_month: 'Karkidakam', message: 'A significant day for ancestor tharpanam.' }),
    ]
    renderBanner()
    expect(await screen.findByText('Karkidaka Vaavu')).toBeInTheDocument()
    expect(screen.queryByText('Amavasya Tharpanam')).not.toBeInTheDocument()
  })

  it('mentions a separate secondary occasion when its title is not already represented', async () => {
    h.days = [baseDay]
    h.rules = [
      rule({ key: 'special_tharpanam', title: 'Special Tharpanam', priority: 5 }),
      rule({ key: 'festival', category: 'observance', title: 'Temple Festival',
        message: 'Temple Festival is observed today.', priority: 1 }),
    ]
    renderBanner()
    expect(await screen.findByText(/Also today: Temple Festival is observed today/)).toBeInTheDocument()
  })

  it('dismisses only this observance on this date', async () => {
    h.days = [baseDay]
    h.rules = [rule({})]
    const first = renderBanner()
    await screen.findByText('Amavasya Tharpanam')
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Amavasya Tharpanam')).not.toBeInTheDocument()
    first.unmount()

    const second = renderBanner()
    await waitFor(() => expect(second.container).toBeEmptyDOMElement())
    expect(localStorage.getItem('nk_dismissed_observance_2026-08-12_monthly_amavasya')).toBe('1')
  })
})
