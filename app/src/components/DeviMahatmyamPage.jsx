import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Languages, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CHAPTERS, TOTAL_CHAPTERS, findChapter } from '../utils/devimahatmyam'
import ErrorBanner from './ErrorBanner'
import PdfViewer from './PdfViewer'

// No "sanskrit" entry yet - no genuine full-text Devanagari edition (split
// by chapter, freely usable) was found. devimahatmya.com's "Sanskrit PDF"
// turned out mislabeled (an English commentary book with zero Devanagari),
// and sanskritdocuments.org/archive.org only had short excerpted stotras or
// IAST-transliterated editions, not the complete 700-verse Devanagari text.
// Add it here once a real source turns up - same "omit rather than
// misrepresent" call as Lalitha Sahasranamam's missing translations.
const LANGUAGES = [
  { key: 'english', label: 'English' },
  { key: 'malayalam', label: 'Malayalam' },
  { key: 'tamil', label: 'Tamil' },
]

const ATTRIBUTION = {
  english: { label: 'Ramakrishna Math (Swami Jagadisvarananda translation)', href: 'https://archive.org/details/durgasaptasatiordevimahatmyaswamijagadisvaranandar.k.mutt_202003_923_a' },
  malayalam: { label: 'malayalamebooks.org', href: 'https://archive.org/details/Devi_Mahatmyam_Sanskrit_Text_with_Malayalam_Translation' },
  tamil: { label: 'Vaidika Vignanam (vignanam.org)', href: 'https://vignanam.org' },
}

// Devi Mahatmyam is a single 13-chapter work (Prathama/Madhyama/Uttama
// Charita), unlike Ramayanam's 6 kandams - so this reads directly at
// /learning/devi-mahatmyam[/:chapter] with no separate picker page, same
// PDF-per-chapter-per-language pattern as KandamPage.jsx otherwise. See
// scripts/content/devimahatmyam-pdfs/README for how the PDFs were sourced
// and split.
function pdfUrl(chapter, language) {
  const path = `devimahatmyam-pdfs/${chapter}/${language}.pdf`
  return supabase.storage.from('learning-content').getPublicUrl(path).data.publicUrl
}

export default function DeviMahatmyamPage() {
  const { chapter: chapterParam } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState('english')

  const lastChapterKey = 'nk_devimahatmyam_last_chapter'

  const currentChapter = useMemo(() => {
    if (chapterParam) return Number(chapterParam)
    const stored = Number(localStorage.getItem(lastChapterKey))
    if (stored >= 1 && stored <= TOTAL_CHAPTERS) return stored
    return 1
  }, [chapterParam])

  const chapter = findChapter(currentChapter)

  useEffect(() => {
    if (!chapter) return
    try { localStorage.setItem(lastChapterKey, String(currentChapter)) } catch { /* private mode */ }
  }, [chapter, currentChapter])

  if (!chapter) return <ErrorBanner message="This learning content doesn't exist" />

  const prevChapter = currentChapter > 1 ? currentChapter - 1 : null
  const nextChapter = currentChapter < TOTAL_CHAPTERS ? currentChapter + 1 : null

  const goTo = (n) => navigate(`/learning/devi-mahatmyam/${n}`)

  const src = pdfUrl(currentChapter, language)
  const attribution = ATTRIBUTION[language]

  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">Devi Mahatmyam</h1>
      <div className="greet-sub">{chapter.charita} - Chapter {currentChapter}</div>

      <div className="sk-sarga-nav">
        <button type="button" className="sk-nav-btn" disabled={!prevChapter}
          onClick={() => goTo(prevChapter)} aria-label="Previous chapter">
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <select className="sk-sarga-select" value={currentChapter}
          onChange={(e) => goTo(Number(e.target.value))} aria-label="Jump to chapter">
          {CHAPTERS.map((c) => (
            <option key={c.number} value={c.number}>Chapter {c.number}</option>
          ))}
        </select>
        <button type="button" className="sk-nav-btn" disabled={!nextChapter}
          onClick={() => goTo(nextChapter)} aria-label="Next chapter">
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="lang-select" role="group" aria-label="Language">
        <Languages size={14} strokeWidth={2.5} />
        {LANGUAGES.map((l) => (
          <button key={l.key} type="button"
            className={`lang-btn ${language === l.key ? 'on' : ''}`}
            aria-pressed={language === l.key}
            onClick={() => setLanguage(l.key)}>
            {l.label}
          </button>
        ))}
      </div>

      <PdfViewer key={src} src={src}
        title={`Devi Mahatmyam Chapter ${currentChapter} (${language})`} />

      <a className="sk-pdf-attribution" href={attribution.href} target="_blank" rel="noopener noreferrer">
        Source: {attribution.label} ↗
      </a>
    </>
  )
}
