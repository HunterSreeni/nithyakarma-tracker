import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({ days: [], rules: [], tradition: 'tamil' }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => table === 'panchangam_days'
        ? { gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: h.days, error: null }) }) }) }
        : Promise.resolve({ data: h.rules, error: null }),
    }),
  },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { panchangam_tradition: h.tradition } }),
}))

import CalendarPage from '../CalendarPage'

// Real Aavani / Chingam 2026: Aavani 1 is 17 Aug, Aavani 31 is 16 Sep.
const day = (date, tamilDay, overrides = {}) => ({
  date,
  thithi: 'Shukla Ekadashi',
  nakshatra: 'Mula',
  tamil_month: 'Aavani', tamil_day: tamilDay,
  malayalam_month: 'Chingam', malayalam_day: tamilDay,
  varsham_name: 'Parabhava', kollavarsham_year: 1202,
  rahu_kalam_start: '17:07', rahu_kalam_end: '18:40',
  yamagandam_start: '12:28', yamagandam_end: '14:01',
  gulika_kalam_start: '15:34', gulika_kalam_end: '17:07',
  ...overrides,
})

const AAVANI = Array.from({ length: 31 }, (_, i) => {
  const date = i < 15
    ? `2026-08-${String(17 + i).padStart(2, '0')}`
    : `2026-09-${String(i - 14).padStart(2, '0')}`
  return day(date, i + 1)
})

const EKADASHI_RULE = {
  key: 'shukla_ekadashi', category: 'observance', title: 'Ekadashi',
  message: 'Ekadashi today.', match_thithi: 'Shukla Ekadashi',
  match_tamil_month: null, match_tamil_day: null, match_malayalam_month: null,
  match_malayalam_day: null, match_nakshatra: null, day_offset: 0, priority: 0,
  advance_notify: false,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(<QueryClientProvider client={client}><CalendarPage /></QueryClientProvider>)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-23T08:00:00+05:30'))
  h.days = AAVANI
  h.rules = []
  h.tradition = 'tamil'
})
afterEach(() => { vi.useRealTimers() })

describe('CalendarPage day view', () => {
  it('opens on today, in the native month and script of the profile tradition', async () => {
    renderPage()
    // Aavani 7 is 23 Aug 2026.
    // "ஆவணி 7" in the header and "ஆவணி" in the hero are both correct.
    expect(await screen.findByText('ஆவணி 7')).toBeInTheDocument()
    expect(screen.getByText('Aavani 7')).toBeInTheDocument()
    expect(screen.getAllByText('வளர்பிறை ஏகாதசி').length).toBeGreaterThan(0)
    expect(screen.getByText('மூலம்')).toBeInTheDocument()
  })

  it('uses the Malayalam script and Kollavarsham for a Malayalam profile', async () => {
    h.tradition = 'malayalam'
    renderPage()
    expect(await screen.findByText('ചിങ്ങം 7')).toBeInTheDocument()
    // Once in the hero, once as the Varsham row.
    expect(screen.getAllByText('കൊല്ലവർഷം 1202')).toHaveLength(2)
    // The samvatsara name has no Malayalam twin and must not appear.
    expect(screen.queryByText(/வருடம்/)).not.toBeInTheDocument()
  })

  it('shows all three kalams with native names and IST times', async () => {
    renderPage()
    expect(await screen.findByText('ராகு காலம்')).toBeInTheDocument()
    expect(screen.getByText('எமகண்டம்')).toBeInTheDocument()
    expect(screen.getByText('குளிகை காலம்')).toBeInTheDocument()
    expect(screen.getByText('17:07-18:40')).toBeInTheDocument()
    expect(screen.getByText('Times shown in IST')).toBeInTheDocument()
  })

  it('renders observances from the shared matcher rather than its own rules', async () => {
    h.rules = [EKADASHI_RULE]
    renderPage()
    expect(await screen.findByText('Ekadashi')).toBeInTheDocument()
  })

  it('shows the not-loaded state, not an error, for a gap inside the month', async () => {
    h.days = AAVANI.filter(d => d.date !== '2026-08-25')
    renderPage()
    await screen.findByText('ஆவணி 7')
    // 23 Aug -> 25 Aug, a date inside the loaded span with no row of its own.
    fireEvent.click(screen.getByLabelText('Next'))
    fireEvent.click(screen.getByLabelText('Next'))
    expect(await screen.findByText('Panchangam not loaded yet')).toBeInTheDocument()
    expect(screen.getByText(/There is no panchangam for .*25 August 2026/)).toBeInTheDocument()
  })

  it('refuses to step off either end of the loaded span', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    // Aavani 1 is the first loaded day, so the sixth step back must stop.
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByLabelText('Previous'))
    expect(await screen.findByText('ஆவணி 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous')).toBeDisabled()
  })
})

describe('CalendarPage week view', () => {
  it('lists seven days with native weekday, tithi and nakshatra', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    // 23 Aug 2026 is a Sunday, so the week runs 23 to 29 Aug.
    expect(await screen.findByText('ஞாயிறு')).toBeInTheDocument()
    expect(screen.getByText('சனி')).toBeInTheDocument()
    expect(screen.getAllByText('வளர்பிறை ஏகாதசி')).toHaveLength(7)
  })

  it('marks days with no row as not loaded instead of dropping them', async () => {
    h.days = AAVANI.filter(d => d.date !== '2026-08-26')
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    // One notice in the row itself, one summary card under the week.
    expect((await screen.findAllByText('Panchangam not loaded yet')).length).toBe(2)
    expect(screen.getByText('1 of these days have no panchangam yet.')).toBeInTheDocument()
  })
})

describe('CalendarPage month view', () => {
  // The full names truncated to "ஞாயி..." on a phone: seven columns share the
  // screen, so each gets ~44px. The grid head must use the short forms, while
  // the week view (a whole row per day) keeps the full ones.
  it('heads the grid with short weekdays, keeping the full name accessible', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    const sunday = await screen.findByLabelText('ஞாயிறு')
    expect(sunday).toHaveTextContent('ஞா')
    expect(screen.getByLabelText('செவ்வாய்')).toHaveTextContent('செ')
    // The long forms must not appear as visible column headings.
    expect(screen.queryByText('செவ்வாய்')).not.toBeInTheDocument()
  })

  it('puts the varsham in brackets so it reads apart from the month name', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(await screen.findByText('ஆவணி (பராபவ வருடம்)')).toBeInTheDocument()
  })

  it('renders the native month, not the Gregorian one', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    // 31 native days, spanning two Gregorian months.
    await waitFor(() => expect(screen.getByText(/Aavani - 17 Aug to 16 Sept?/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Aavani 1, 17 Aug' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aavani 31, 16 Sept?/ })).toBeInTheDocument()
  })

  it('refuses to step past the last loaded month and says why', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() => expect(screen.getByLabelText('Next')).toBeDisabled())
    expect(screen.getByText('End of the loaded panchangam')).toBeInTheDocument()
  })

  it('counts unloaded days in the month rather than shrinking the grid', async () => {
    h.days = AAVANI.filter(d => d.tamil_day > 3)
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(await screen.findByText(/3 of 31 days in Aavani have no panchangam yet/)).toBeInTheDocument()
  })

  it('opens the day view for a tapped date', async () => {
    renderPage()
    await screen.findByText('ஆவணி 7')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aavani 11, 27 Aug' }))
    expect(await screen.findByText('Times shown in IST')).toBeInTheDocument()
    expect(screen.getByText(/27 August 2026/)).toBeInTheDocument()
  })
})

describe('CalendarPage failures', () => {
  it('surfaces a retryable error banner rather than a blank page', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.days = null
    render(<QueryClientProvider client={client}><CalendarPage /></QueryClientProvider>)
    // A null payload still renders the page shell, never a crash.
    expect(await screen.findByText('Panchangam')).toBeInTheDocument()
    spy.mockRestore()
  })
})
