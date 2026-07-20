import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RamayanaMasamPage from '../RamayanaMasamPage'

describe('RamayanaMasamPage', () => {
  it('lists exactly the six kandams read during Karkidakam', () => {
    render(<MemoryRouter><RamayanaMasamPage /></MemoryRouter>)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(6)
    for (const k of ['Bala Kandam', 'Ayodhya Kandam', 'Aranya Kandam', 'Kishkindha Kandam', 'Sundara Kandam', 'Yuddha Kandam']) {
      expect(screen.getByText(k)).toBeInTheDocument()
    }
  })

  it('notes that Uttara Kandam is excluded from this reading, without listing it as one of the six', () => {
    render(<MemoryRouter><RamayanaMasamPage /></MemoryRouter>)
    expect(screen.getByText(/Uttara Kandam, is not part of this reading/)).toBeInTheDocument()
  })
})
