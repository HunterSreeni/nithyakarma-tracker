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

  it('renders the varsham, month/day, thithi, nakshatra, and kalam windows', () => {
    h.loading = false
    h.day = {
      varsham_name: 'Parabhava', malayalam_month: 'Mithunam', malayalam_day: 31,
      tamil_month: 'Aani', tamil_day: 31, thithi: 'Shukla Tritiya', nakshatra: 'Ashlesha',
      rahu_kalam_start: '14:06', rahu_kalam_end: '15:41',
      yamagandam_start: '06:11', yamagandam_end: '07:46',
      gulika_kalam_start: '09:21', gulika_kalam_end: '10:56',
    }
    render(<PanchangamBox />)
    expect(screen.getByText('Parabhava Varsham')).toBeInTheDocument()
    expect(screen.getByText(/Mithunam 31 \(Malayalam\)/)).toBeInTheDocument()
    expect(screen.getByText(/Aani 31 \(Tamil\)/)).toBeInTheDocument()
    expect(screen.getByText(/Shukla Tritiya/)).toBeInTheDocument()
    expect(screen.getByText(/Ashlesha Nakshatram/)).toBeInTheDocument()
    expect(screen.getByText('Rahu Kalam 14:06-15:41')).toBeInTheDocument()
  })
})
