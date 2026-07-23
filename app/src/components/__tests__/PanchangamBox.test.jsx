import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ day: null, loading: true, tradition: 'tamil' }))
vi.mock('../../hooks/usePanchangam', () => ({
  usePanchangam: () => ({ day: h.day, loading: h.loading }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: { panchangam_tradition: h.tradition } }),
}))

import PanchangamBox from '../PanchangamBox'

beforeEach(() => { h.day = null; h.loading = true; h.tradition = 'tamil' })

describe('PanchangamBox', () => {
  it('renders nothing while loading', () => {
    h.loading = true
    const { container } = render(<PanchangamBox />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when no row exists for today (year-boundary gap)', () => {
    h.loading = false
    h.day = null
    const { container } = render(<PanchangamBox />)
    expect(container).toBeEmptyDOMElement()
  })

  const fullDay = {
    varsham_name: 'Parabhava', kollavarsham_year: 1201,
    malayalam_month: 'Mithunam', malayalam_day: 31,
    tamil_month: 'Aani', tamil_day: 31, thithi: 'Shukla Tritiya', nakshatra: 'Ashlesha',
    rahu_kalam_start: '14:06', rahu_kalam_end: '15:41',
    yamagandam_start: '06:11', yamagandam_end: '07:46',
    gulika_kalam_start: '09:21', gulika_kalam_end: '10:56',
  }

  it('shows only the Tamil fields when panchangam_tradition is tamil (the default)', () => {
    h.loading = false
    h.day = fullDay
    h.tradition = 'tamil'
    render(<PanchangamBox />)
    expect(screen.getByText('பராபவ வருடம்', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/ஆனி \[Aani\] 31/)).toBeInTheDocument()
    expect(screen.getByText(/திருதியை \[Shukla Tritiya\]/)).toBeInTheDocument()
    expect(screen.getByText(/ஆயில்யம் \[Ashlesha\] Nakshatram/)).toBeInTheDocument()
    expect(screen.getByText('Rahu Kalam')).toBeInTheDocument()
    expect(screen.getByText('ராகு காலம்')).toBeInTheDocument()
    expect(screen.getByText('14:06-15:41')).toBeInTheDocument()
    // Malayalam-only facts must not leak in
    expect(screen.queryByText(/கொல்ல/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mithunam/)).not.toBeInTheDocument()
  })

  it('shows only the Malayalam fields when panchangam_tradition is malayalam', () => {
    h.loading = false
    h.day = fullDay
    h.tradition = 'malayalam'
    render(<PanchangamBox />)
    expect(screen.getByText('കൊല്ലവർഷം 1201')).toBeInTheDocument()
    expect(screen.getByText(/മിഥുനം \[Mithunam\] 31/)).toBeInTheDocument()
    expect(screen.getByText(/ശുക്ലപക്ഷം തൃതീയ \[Shukla Tritiya\]/)).toBeInTheDocument()
    expect(screen.getByText(/ആയില്യം \[Ashlesha\] Nakshatram/)).toBeInTheDocument()
    expect(screen.getByText('Rahu Kalam')).toBeInTheDocument()
    expect(screen.getByText('രാഹുകാലം')).toBeInTheDocument()
    expect(screen.getByText('14:06-15:41')).toBeInTheDocument()
    // Tamil-only facts must not leak in
    expect(screen.queryByText(/வருடம்/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Aani/)).not.toBeInTheDocument()
  })

  it('labels the kalam times as IST, since they are always Indian Standard Time regardless of viewer location', () => {
    h.loading = false
    h.day = fullDay
    render(<PanchangamBox />)
    expect(screen.getByText('Times shown in IST')).toBeInTheDocument()
  })

  it('defaults to Tamil rendering when panchangam_tradition is missing (matches the DB default)', () => {
    h.loading = false
    h.day = fullDay
    h.tradition = undefined
    render(<PanchangamBox />)
    expect(screen.getByText('பராபவ வருடம்', { exact: false })).toBeInTheDocument()
  })

  it('omits the Kollavarsham half for rows predating the kollavarsham_year column (Malayalam tradition)', () => {
    h.loading = false
    h.day = { ...fullDay, kollavarsham_year: null }
    h.tradition = 'malayalam'
    render(<PanchangamBox />)
    expect(screen.queryByText(/கொல்ல/)).not.toBeInTheDocument()
    expect(screen.getByText('Parabhava')).toBeInTheDocument()
  })

  it('falls back to the stored transliteration when a value has no script mapping', () => {
    h.loading = false
    h.day = { ...fullDay, varsham_name: 'Unmapped', nakshatra: 'Unmapped', thithi: 'Unmapped' }
    render(<PanchangamBox />)
    expect(screen.getByText('Unmapped வருடம்')).toBeInTheDocument()
    expect(screen.getByText(/Unmapped \[Unmapped\] Nakshatram/)).toBeInTheDocument()
  })
})
