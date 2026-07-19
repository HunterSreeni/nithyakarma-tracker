import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ day: null, loading: true }))
vi.mock('../../hooks/usePanchangam', () => ({
  usePanchangam: () => ({ day: h.day, loading: h.loading }),
}))

import PanchangamBox from '../PanchangamBox'

beforeEach(() => { h.day = null; h.loading = true })

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

  it('renders the varsham, month/day, thithi, nakshatra, and kalam windows', () => {
    h.loading = false
    h.day = fullDay
    render(<PanchangamBox />)
    // Kerala counts the era; Tamil Nadu names the year from the 60-cycle.
    expect(screen.getByText('കൊല്ലവർഷം 1201')).toBeInTheDocument()
    expect(screen.getByText('பராபவ வருடம்')).toBeInTheDocument()
    expect(screen.getByText(/മിഥുനം \[Mithunam\] 31/)).toBeInTheDocument()
    expect(screen.getByText(/ஆனி \[Aani\] 31/)).toBeInTheDocument()
    expect(screen.getByText(/ശുക്ലപക്ഷം തൃതീയ · வளர்பிறை திருதியை \[Shukla Tritiya\]/)).toBeInTheDocument()
    expect(screen.getByText(/ആയില്യം · ஆயில்யம் \[Ashlesha\] Nakshatram/)).toBeInTheDocument()
    expect(screen.getByText('Rahu Kalam')).toBeInTheDocument()
    expect(screen.getByText('രാഹുകാലം · ராகு காலம்')).toBeInTheDocument()
    expect(screen.getByText('14:06-15:41')).toBeInTheDocument()
  })

  it('omits the Kollavarsham half for rows predating the kollavarsham_year column', () => {
    h.loading = false
    h.day = { ...fullDay, kollavarsham_year: null }
    render(<PanchangamBox />)
    expect(screen.queryByText(/കൊല്ലവർഷം/)).not.toBeInTheDocument()
    expect(screen.getByText('பராபவ வருடம்')).toBeInTheDocument()
  })

  it('falls back to the stored transliteration when a value has no script mapping', () => {
    h.loading = false
    h.day = { ...fullDay, varsham_name: 'Unmapped', nakshatra: 'Unmapped', thithi: 'Unmapped' }
    render(<PanchangamBox />)
    expect(screen.getByText('Unmapped வருடம்')).toBeInTheDocument()
    expect(screen.getByText(/Unmapped · Unmapped \[Unmapped\] Nakshatram/)).toBeInTheDocument()
  })
})
