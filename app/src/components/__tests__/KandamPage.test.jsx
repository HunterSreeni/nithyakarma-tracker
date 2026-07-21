import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({ kandam: 'sundara', sarga: undefined }))
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useParams: () => ({ kandam: h.kandam, sarga: h.sarga }), useNavigate: () => navigateMock }
})
vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/learning-content/${path}` } }),
      }),
    },
  },
}))
// PdfViewer's real rendering (pdf.js + canvas + a web worker) isn't
// meaningfully testable in jsdom - see PdfViewer.test.jsx for that. Here
// it's stubbed so KandamPage's own logic (sarga nav, url building) can be
// asserted against a plain, inspectable element.
vi.mock('../PdfViewer', () => ({
  default: ({ src, title }) => <div data-testid="pdf-viewer" title={title} data-src={src} />,
}))

import KandamPage from '../KandamPage'

beforeEach(() => {
  vi.clearAllMocks()
  navigateMock.mockClear()
  h.kandam = 'sundara'
  h.sarga = undefined
  localStorage.clear()
})

describe('KandamPage', () => {
  it('shows an error banner for an unknown kandam slug', () => {
    h.kandam = 'not-a-real-kandam'
    render(<KandamPage />)
    expect(screen.getByText("This learning content doesn't exist")).toBeInTheDocument()
  })

  it('defaults to sarga 1 when no :sarga param and no saved progress', () => {
    render(<KandamPage />)
    expect(screen.getByLabelText('Jump to sarga')).toHaveValue('1')
    expect(screen.getByTitle('Sundara Kandam Sarga 1 (sanskrit)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/ramayanam-pdfs/sundara/sanskrit/1.pdf')
  })

  it('reads the :sarga param and builds the matching PDF url', () => {
    h.sarga = '7'
    render(<KandamPage />)
    expect(screen.getByLabelText('Jump to sarga')).toHaveValue('7')
    expect(screen.getByTitle('Sundara Kandam Sarga 7 (sanskrit)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/ramayanam-pdfs/sundara/sanskrit/7.pdf')
  })

  it('keeps per-kandam last-read progress separate', () => {
    h.kandam = 'yuddha'
    render(<KandamPage />)
    expect(localStorage.getItem('nk_ramayanam_last_sarga_yuddha')).toBe('1')
    expect(localStorage.getItem('nk_ramayanam_last_sarga_sundara')).toBeNull()
  })

  it('resumes from the last-read sarga saved in localStorage when no :sarga param', () => {
    localStorage.setItem('nk_ramayanam_last_sarga_sundara', '15')
    render(<KandamPage />)
    expect(screen.getByLabelText('Jump to sarga')).toHaveValue('15')
  })

  it('prev/next buttons navigate within the kandam sarga range', () => {
    h.sarga = '5'
    render(<KandamPage />)
    fireEvent.click(screen.getByLabelText('Next sarga'))
    expect(navigateMock).toHaveBeenCalledWith('/learning/ramayanam/sundara/6')
    fireEvent.click(screen.getByLabelText('Previous sarga'))
    expect(navigateMock).toHaveBeenCalledWith('/learning/ramayanam/sundara/4')
  })

  it('disables prev on sarga 1 and next on the kandam\'s last sarga', () => {
    h.sarga = '1'
    const { rerender } = render(<KandamPage />)
    expect(screen.getByLabelText('Previous sarga')).toBeDisabled()
    h.sarga = '68'
    rerender(<KandamPage />)
    expect(screen.getByLabelText('Next sarga')).toBeDisabled()
  })

  it('caps the sarga range to the current kandam\'s own total', () => {
    h.kandam = 'kishkindha'
    h.sarga = '67'
    render(<KandamPage />)
    expect(screen.getByLabelText('Next sarga')).toBeDisabled()
  })

  it('switches the PDF url on language toggle', () => {
    h.sarga = '3'
    render(<KandamPage />)
    fireEvent.click(screen.getByText('Malayalam'))
    expect(screen.getByTitle('Sundara Kandam Sarga 3 (malayalam)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/ramayanam-pdfs/sundara/malayalam/3.pdf')
  })

  it('links attribution to the currently displayed PDF', () => {
    h.sarga = '3'
    render(<KandamPage />)
    expect(screen.getByText(/Source: prapatti\.com/))
      .toHaveAttribute('href', 'https://storage.example/learning-content/ramayanam-pdfs/sundara/sanskrit/3.pdf')
  })
})
