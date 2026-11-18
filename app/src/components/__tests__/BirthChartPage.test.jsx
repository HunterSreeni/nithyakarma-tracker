import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axe from 'axe-core'

const h = vi.hoisted(() => ({ store: {}, track: vi.fn() }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: h.store[key] ?? null }),
    set: async ({ key, value }) => { h.store[key] = value },
    remove: async ({ key }) => { delete h.store[key] },
  },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { display_name: 'Sreeni' },
    familyMembers: [{ id: 'f1', name: 'Meera' }],
  }),
}))
vi.mock('../../utils/analytics', () => ({ track: (...a) => h.track(...a) }))

import BirthChartPage from '../BirthChartPage'
import { birthDetailsToUtc as toUtc, formatBirthDate } from '../../lib/jadhagam/time'
import { solarDate } from '../../lib/jadhagam/panchangam'
import { RASIS } from '../../lib/jadhagam/chart'

const place = { name: 'Thrissur', state: 'Kerala', lat: 10.517, lon: 76.217, tz: 'Asia/Kolkata' }
const saved = { id: 'c1', name: 'Sreeni', relation: 'self', familyMemberId: null, tradition: 'tamil', date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM', place, offsetOverride: '' }
const store = (charts) => { h.store['birth-charts:u1'] = JSON.stringify(charts) }
const stored = () => JSON.parse(h.store['birth-charts:u1'] ?? '[]')
const renderAt = (path = '/birth-chart') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/birth-chart/*" element={<BirthChartPage />} /></Routes>
  </MemoryRouter>,
)

async function fillBirth({ placeQuery = 'thriss' } = {}) {
  fireEvent.change(await screen.findByLabelText('Date of birth'), { target: { value: '1981-02-10' } })
  fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '9' } })
  fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } })
  fireEvent.change(screen.getByLabelText('Place of birth (India)'), { target: { value: placeQuery } })
  fireEvent.click(await screen.findByRole('option', { name: /Thrissur/ }))
}

beforeEach(() => { h.store = {}; h.track = vi.fn(); window.scrollTo = vi.fn() })

describe('BirthChartPage', () => {
  it('opens the form for a first chart, prefilled as the account owner', async () => {
    renderAt()
    expect(await screen.findByLabelText('Name')).toHaveValue('Sreeni')
    expect(screen.getByRole('button', { name: 'Me' })).toHaveAttribute('aria-pressed', 'true')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('validates, saves on this phone and shows the chart with tabs', async () => {
    renderAt('/birth-chart/new')
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sreeni' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the date of birth.')

    await fillBirth()
    // A Kerala birth place suggests the Kerala tradition.
    expect(screen.getByRole('button', { name: 'Kerala (Malayalam)' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Make chart' }))

    expect(await screen.findByRole('heading', { name: 'Sreeni' })).toBeInTheDocument()
    expect(screen.getByText(/10 Feb 1981, 9:15 AM - Thrissur \(UTC\+05:30\)/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rasi chart')).toBeInTheDocument()
    expect(screen.getByLabelText('Amsam chart')).toBeInTheDocument()
    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatchObject({ name: 'Sreeni', relation: 'self', tradition: 'kerala', date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM' })
    // Analytics gets the event name only, never birth details.
    expect(h.track).toHaveBeenCalledWith('birth_chart_viewed')
    expect(h.track.mock.calls.every((c) => c.length === 1)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Planets' }))
    expect(screen.getAllByRole('row')).toHaveLength(11) // header + lagna + 9 grahas
    fireEvent.click(screen.getByRole('button', { name: 'Panchangam' }))
    expect(screen.getByText('Star lord')).toBeInTheDocument()
    // Kerala chart: Kollam year and Malayalam month.
    expect(screen.getByText('Kollam year')).toBeInTheDocument()
    expect(screen.getByText('Malayalam month, date')).toBeInTheDocument()
    expect(screen.getByText(/^\d+ nazhigai \d+ vinadi$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dasa' }))
    expect(screen.getByText(/Dasa balance at birth/)).toBeInTheDocument()
  })

  it('keeps a tradition the user picked even after choosing a place', async () => {
    renderAt('/birth-chart/new')
    fireEvent.click(await screen.findByRole('button', { name: 'Tamil' }))
    await fillBirth()
    expect(screen.getByRole('button', { name: 'Tamil' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists saved charts and adds a family member chart', async () => {
    store([saved])
    renderAt()
    const item = await screen.findByRole('link', { name: /Sreeni/ })
    expect(item).toHaveTextContent('(You)')
    expect(item).toHaveTextContent(/rasi - .* lagna/)

    fireEvent.click(screen.getByRole('link', { name: /New chart/ }))
    // Not the first chart, so it is not preselected as the owner's.
    expect(await screen.findByLabelText('Name')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Meera' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Meera')
    await fillBirth()
    fireEvent.click(screen.getByRole('button', { name: 'Make chart' }))
    expect(await screen.findByRole('heading', { name: 'Meera' })).toBeInTheDocument()
    // Each chart screen opens at the top.
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0)
    expect(stored().map((c) => [c.name, c.relation, c.familyMemberId])).toEqual([['Sreeni', 'self', null], ['Meera', 'family', 'f1']])
  })

  it('switches the chart labels between Tamil and English', async () => {
    store([saved])
    renderAt('/birth-chart/c1')
    const grid = await screen.findByLabelText('Rasi chart')
    expect(within(grid).getByText('ராசி')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(within(screen.getByLabelText('Rasi chart')).getByText('Rasi')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Rasi chart')).getByText('La')).toBeInTheDocument()
  })

  it('shows the Tamil year and month for a Tamil chart', async () => {
    store([saved])
    renderAt('/birth-chart/c1?tab=panchangam')
    expect(await screen.findByText('Tamil year')).toBeInTheDocument()
    expect(screen.getByText('Tamil month, date')).toBeInTheDocument()
    expect(screen.getByText('Weekday')).toBeInTheDocument()
  })

  it('shows what is running now on the chart tab', async () => {
    store([saved])
    renderAt('/birth-chart/c1')
    const now = await screen.findByRole('region', { name: 'Now' })
    for (const label of ['Dasa', 'Saturn', 'Jupiter', 'Chandrashtamam', 'Star birthday', 'Age', 'Today']) {
      expect(within(now).getByText(label)).toBeInTheDocument()
    }
    expect(within(now).getByText(/ dasa, .* bhukti, .* antaram$/)).toBeInTheDocument()
    expect(within(now).getAllByRole('listitem')).toHaveLength(3) // three chandrashtamam spells
  })

  it('opens any dasa to show its bhuktis, with antarams under the current one', async () => {
    store([saved])
    renderAt('/birth-chart/c1?tab=dasa')
    await screen.findByText(/Dasa balance at birth/)
    // The current dasa starts open, with the running bhukti's antarams.
    expect(screen.getAllByRole('list', { name: /^Bhuktis of / })).toHaveLength(1)
    expect(screen.getByRole('list', { name: /^Antarams of / })).toBeInTheDocument()
    const closed = screen.getAllByRole('button', { expanded: false }).find((b) => b.classList.contains('bc-dasa-row'))
    fireEvent.click(closed)
    expect(screen.getAllByRole('list', { name: /^Bhuktis of / })).toHaveLength(2)
  })

  it('opens a Kerala chart in Malayalam, with Malayalam script on every tab', async () => {
    store([{ ...saved, tradition: 'kerala' }])
    renderAt('/birth-chart/c1')
    const grid = await screen.findByLabelText('Rasi chart')
    expect(within(grid).getByText('രാശി')).toBeInTheDocument()
    expect(within(grid).getByText('മേടം')).toBeInTheDocument()
    expect(within(grid).getByText('ല')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'മലയാളം' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Panchangam' }))
    expect(screen.getByText(/^Shukla \(ശുക്ലപക്ഷം\)$|^Krishna \(കൃഷ്ണപക്ഷം\)$/)).toBeInTheDocument()
    // Thrissur, 10 Feb 1981 9:15 AM: the Kerala (aparahna) month and date, in both scripts.
    const m = solarDate('1981-02-10', place, 'kerala')
    expect(m).toEqual({ month: 9, day: 28 })
    expect(screen.getByText(`Makaram 28 (${RASIS[9].ml} 28)`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Planets' }))
    expect(screen.getByText('ചന്ദ്രൻ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dasa' }))
    expect(screen.getAllByText('ചന്ദ്രൻ').length).toBeGreaterThan(0)
    expect(screen.queryByText('சந்திரன்')).not.toBeInTheDocument() // no Tamil on a Kerala chart
  })

  it('keeps the full disclaimer one tap away', async () => {
    store([saved])
    renderAt('/birth-chart/c1')
    expect(await screen.findByText('Calculated, not a prediction.')).toBeInTheDocument()
    expect(screen.queryByText('ASTROLOGY IS NOT SCIENCE')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Read more' }))
    expect(screen.getByText('ASTROLOGY IS NOT SCIENCE')).toBeInTheDocument()
  })

  it('edits a chart, then deletes it after a confirmation', async () => {
    store([saved, { ...saved, id: 'c2', name: 'Meera' }])
    renderAt('/birth-chart/c1/edit')
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Sreenivasan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save chart' }))
    expect(await screen.findByRole('heading', { name: 'Sreenivasan' })).toBeInTheDocument()
    expect(stored().map((c) => c.name)).toEqual(['Sreenivasan', 'Meera'])

    fireEvent.click(screen.getByRole('link', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete this chart' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it from this phone' }))
    await waitFor(() => expect(stored().map((c) => c.id)).toEqual(['c2']))
    expect(await screen.findByRole('link', { name: /Meera/ })).toBeInTheDocument()
  })

  it('rejects an impossible time offset', async () => {
    renderAt('/birth-chart/new')
    await fillBirth()
    fireEvent.change(screen.getByLabelText('UTC offset, for example +05:30'), { target: { value: '+99:99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('between -12:00 and +14:00')
    expect(h.store['birth-charts:u1']).toBeUndefined()
  })

  it('sends an unknown chart id back to the list', async () => {
    store([saved])
    renderAt('/birth-chart/nope')
    expect(await screen.findByRole('link', { name: /Sreeni/ })).toBeInTheDocument()
  })
})

describe('helpers', () => {
  it('formats the birth date from the string, not a time zone', () => {
    expect(formatBirthDate('1994-03-05')).toBe('5 Mar 1994')
    expect(formatBirthDate('2000-12-31')).toBe('31 Dec 2000')
  })

  it('reads 12-hour time, including 12 AM and 12 PM', () => {
    expect(toUtc({ ...saved, hour12: 12, minute: 0, ampm: 'AM' }).toISOString()).toBe('1981-02-09T18:30:00.000Z')
    expect(toUtc({ ...saved, hour12: 12, minute: 0, ampm: 'PM' }).toISOString()).toBe('1981-02-10T06:30:00.000Z')
    expect(toUtc({ ...saved, hour12: 3, minute: 5, ampm: 'PM' }).toISOString()).toBe('1981-02-10T09:35:00.000Z')
  })

  it('applies a recorded offset instead of the zone rule', () => {
    expect(toUtc({ ...saved, offsetOverride: '+06:30' }).toISOString()).toBe('1981-02-10T02:45:00.000Z')
    expect(toUtc({ ...saved, offsetOverride: '-01:00' }).toISOString()).toBe('1981-02-10T10:15:00.000Z')
  })
})

describe('BirthChartPage accessibility (axe, serious/critical)', () => {
  // Contrast needs a real browser; region is covered by Layout's <main> in the app.
  const CONFIG = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } }
  const serious = async (el) => (await axe.run(el, CONFIG)).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id)

  it('has no serious violations on the form, the list or the chart', async () => {
    const form = renderAt('/birth-chart/new')
    await screen.findByLabelText('Date of birth')
    expect(await serious(form.container)).toEqual([])
    form.unmount()

    store([saved])
    const list = renderAt()
    await screen.findByRole('link', { name: /Sreeni/ })
    expect(await serious(list.container)).toEqual([])
    list.unmount()

    const chart = renderAt('/birth-chart/c1')
    await screen.findByLabelText('Rasi chart')
    expect(await serious(chart.container)).toEqual([])
  })
})
