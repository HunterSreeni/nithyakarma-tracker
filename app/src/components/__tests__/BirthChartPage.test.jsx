import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'

const h = vi.hoisted(() => ({ store: {}, track: vi.fn() }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: h.store[key] ?? null }),
    set: async ({ key, value }) => { h.store[key] = value },
    remove: async ({ key }) => { delete h.store[key] },
  },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../utils/analytics', () => ({ track: (...a) => h.track(...a) }))

import BirthChartPage from '../BirthChartPage'
import { birthDetailsToUtc as toUtc } from '../../lib/jadhagam/time'

const saved = { date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM', place: { name: 'Thrissur', state: 'Kerala', lat: 10.517, lon: 76.217, tz: 'Asia/Kolkata' }, offsetOverride: '' }
const renderPage = () => render(<MemoryRouter><BirthChartPage /></MemoryRouter>)

beforeEach(() => { h.store = {}; h.track = vi.fn() })

describe('BirthChartPage', () => {
  it('always shows the disclaimer, and asks for details when none are saved', async () => {
    renderPage()
    expect(screen.getByText('ASTROLOGY IS NOT SCIENCE')).toBeInTheDocument()
    expect(await screen.findByLabelText('Date of birth')).toBeInTheDocument()
    expect(h.track).not.toHaveBeenCalled()
  })

  it('validates, then saves on this phone and shows the chart', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Show my chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the date of birth.')

    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1981-02-10' } })
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show my chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick the birth place')

    fireEvent.change(screen.getByLabelText('Place of birth (India)'), { target: { value: 'thriss' } })
    fireEvent.click(await screen.findByRole('option', { name: /Thrissur/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Show my chart' }))

    expect(await screen.findByText('Summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Rasi chart')).toBeInTheDocument()
    expect(screen.getByLabelText('Amsam chart')).toBeInTheDocument()
    expect(JSON.parse(h.store['birth-details:u1'])).toMatchObject({ date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM' })
    // Analytics gets the event name only, never birth details.
    expect(h.track).toHaveBeenCalledWith('birth_chart_viewed')
    expect(h.track.mock.calls.every((c) => c.length === 1)).toBe(true)

    // Editing and saving again is not a second view.
    fireEvent.click(screen.getByRole('button', { name: 'Edit birth details' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Show my chart' }))
    await screen.findByText('Summary')
    expect(h.track).toHaveBeenCalledTimes(1)
  })

  it('rejects an impossible time offset', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Date of birth'), { target: { value: '1981-02-10' } })
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Place of birth (India)'), { target: { value: 'thriss' } })
    fireEvent.click(await screen.findByRole('option', { name: /Thrissur/ }))
    fireEvent.change(screen.getByLabelText('UTC offset, for example +05:30'), { target: { value: '+99:99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show my chart' }))
    expect(screen.getByRole('alert')).toHaveTextContent('between -12:00 and +14:00')
    expect(h.store['birth-details:u1']).toBeUndefined()
  })

  it('shows the saved chart, then deletes the details after a confirmation', async () => {
    h.store['birth-details:u1'] = JSON.stringify(saved)
    renderPage()
    expect(await screen.findByText(/Born 1981-02-10 at 9:15 AM, Thrissur \(UTC\+05:30\)/)).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(11) // header + lagna + 9 grahas

    fireEvent.click(screen.getByRole('button', { name: 'Delete my birth details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete them from this phone' }))
    await waitFor(() => expect(h.store['birth-details:u1']).toBeUndefined())
    expect(await screen.findByLabelText('Date of birth')).toHaveValue('')
  })
})

describe('toUtc', () => {
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

  it('has no serious violations on the form or the chart', async () => {
    const form = renderPage()
    await screen.findByLabelText('Date of birth')
    expect(await serious(form.container)).toEqual([])
    form.unmount()

    h.store['birth-details:u1'] = JSON.stringify(saved)
    const chart = renderPage()
    await screen.findByText('Summary')
    expect(await serious(chart.container)).toEqual([])
  })
})
