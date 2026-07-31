import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({ chapter: undefined }))
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useParams: () => ({ chapter: h.chapter }), useNavigate: () => navigateMock }
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
// Same rationale as KandamPage.test.jsx - PdfViewer's real pdf.js/canvas
// pipeline isn't meaningfully testable in jsdom, so it's stubbed here to
// assert this component's own logic (chapter nav, url building) instead.
vi.mock('../PdfViewer', () => ({
  default: ({ src, title }) => <div data-testid="pdf-viewer" title={title} data-src={src} />,
}))

import DeviMahatmyamPage from '../DeviMahatmyamPage'

beforeEach(() => {
  vi.clearAllMocks()
  navigateMock.mockClear()
  h.chapter = undefined
  localStorage.clear()
})

describe('DeviMahatmyamPage', () => {
  it('shows an error banner for a chapter number outside 1-13', () => {
    h.chapter = '99'
    render(<DeviMahatmyamPage />)
    expect(screen.getByText("This learning content doesn't exist")).toBeInTheDocument()
  })

  it('defaults to chapter 1 (Prathama Charita) when no :chapter param and no saved progress', () => {
    render(<DeviMahatmyamPage />)
    expect(screen.getByLabelText('Jump to chapter')).toHaveValue('1')
    expect(screen.getByText('Prathama Charita - Chapter 1')).toBeInTheDocument()
    expect(screen.getByTitle('Devi Mahatmyam Chapter 1 (english)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/devimahatmyam-pdfs/1/english.pdf')
  })

  it('reads the :chapter param, showing its charita grouping and PDF url', () => {
    h.chapter = '7'
    render(<DeviMahatmyamPage />)
    expect(screen.getByLabelText('Jump to chapter')).toHaveValue('7')
    expect(screen.getByText('Uttama Charita - Chapter 7')).toBeInTheDocument()
    expect(screen.getByTitle('Devi Mahatmyam Chapter 7 (english)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/devimahatmyam-pdfs/7/english.pdf')
  })

  it('resumes from the last-read chapter saved in localStorage when no :chapter param', () => {
    localStorage.setItem('nk_devimahatmyam_last_chapter', '5')
    render(<DeviMahatmyamPage />)
    expect(screen.getByLabelText('Jump to chapter')).toHaveValue('5')
  })

  it('prev/next buttons navigate within the 1-13 chapter range', () => {
    h.chapter = '5'
    render(<DeviMahatmyamPage />)
    fireEvent.click(screen.getByLabelText('Next chapter'))
    expect(navigateMock).toHaveBeenCalledWith('/learning/devi-mahatmyam/6')
    fireEvent.click(screen.getByLabelText('Previous chapter'))
    expect(navigateMock).toHaveBeenCalledWith('/learning/devi-mahatmyam/4')
  })

  it('disables prev on chapter 1 and next on chapter 13', () => {
    h.chapter = '1'
    const { rerender } = render(<DeviMahatmyamPage />)
    expect(screen.getByLabelText('Previous chapter')).toBeDisabled()
    h.chapter = '13'
    rerender(<DeviMahatmyamPage />)
    expect(screen.getByLabelText('Next chapter')).toBeDisabled()
  })

  it('offers only the three sourced languages (no Sanskrit yet)', () => {
    render(<DeviMahatmyamPage />)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Malayalam')).toBeInTheDocument()
    expect(screen.getByText('Tamil')).toBeInTheDocument()
    expect(screen.queryByText('Sanskrit')).not.toBeInTheDocument()
  })

  it('switches the PDF url and attribution link on language toggle', () => {
    h.chapter = '3'
    render(<DeviMahatmyamPage />)
    fireEvent.click(screen.getByText('Tamil'))
    expect(screen.getByTitle('Devi Mahatmyam Chapter 3 (tamil)'))
      .toHaveAttribute('data-src', 'https://storage.example/learning-content/devimahatmyam-pdfs/3/tamil.pdf')
    expect(screen.getByText(/Source: Vaidika Vignanam/)).toHaveAttribute('href', 'https://vignanam.org')
  })

  it('links attribution to the source publisher for the current language', () => {
    render(<DeviMahatmyamPage />)
    expect(screen.getByText(/Source: Ramakrishna Math/))
      .toHaveAttribute('href', 'https://archive.org/details/durgasaptasatiordevimahatmyaswamijagadisvaranandar.k.mutt_202003_923_a')
  })
})
