import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RamayanamPage from '../RamayanamPage'

describe('RamayanamPage', () => {
  it('lists all six kandams, linking to the kandam-specific reader route', () => {
    render(<MemoryRouter><RamayanamPage /></MemoryRouter>)
    expect(screen.getByText('Bala Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/bala')
    expect(screen.getByText('Ayodhya Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/ayodhya')
    expect(screen.getByText('Aranya Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/aranya')
    expect(screen.getByText('Kishkindha Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/kishkindha')
    expect(screen.getByText('Sundara Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/sundara')
    expect(screen.getByText('Yuddha Kandam').closest('a')).toHaveAttribute('href', '/learning/ramayanam/yuddha')
  })

  it('shows the sarga count for each kandam', () => {
    render(<MemoryRouter><RamayanamPage /></MemoryRouter>)
    expect(screen.getByText('128 sargas')).toBeInTheDocument()
    expect(screen.getByText('68 sargas')).toBeInTheDocument()
  })
})
