import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Languages, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { findKandam } from '../utils/ramayanam'
import ErrorBanner from './ErrorBanner'
import PdfViewer from './PdfViewer'

const LANGUAGES = [
  { key: 'sanskrit', label: 'Sanskrit' },
  { key: 'malayalam', label: 'Malayalam' },
]

// Every kandam of the Ramayanam (Bala through Yuddha) is too large for the
// flat, single-scroll reader every other Learning practice uses. Rather
// than a custom verse-by-verse card reader, this shows the actual sarga
// PDFs (Sanskrit + Malayalam, compiled by Sunder Kidambi at prapatti.com)
// page by page via PdfViewer - see scripts/download-ramayanam-pdfs.cjs for
// how they're fetched. prapatti.com's own copies send
// `X-Frame-Options: SAMEORIGIN` and can't be framed directly, so these are
// re-hosted (with attribution below the reader) in the learning-content
// Storage bucket. PdfViewer renders via pdf.js/canvas rather than an
// <iframe>, since Android's WebView has no native PDF plugin to render one.
function pdfUrl(kandamSlug, language, sarga) {
  const path = `ramayanam-pdfs/${kandamSlug}/${language}/${sarga}.pdf`
  return supabase.storage.from('learning-content').getPublicUrl(path).data.publicUrl
}

export default function KandamPage() {
  const { kandam: kandamSlug, sarga: sargaParam } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState('sanskrit')

  const kandam = findKandam(kandamSlug)
  const lastSargaKey = `nk_ramayanam_last_sarga_${kandamSlug}`

  const currentSarga = useMemo(() => {
    if (!kandam) return null
    if (sargaParam) return Number(sargaParam)
    const stored = Number(localStorage.getItem(lastSargaKey))
    if (stored >= 1 && stored <= kandam.totalSargas) return stored
    return 1
  }, [kandam, sargaParam, lastSargaKey])

  useEffect(() => {
    if (!currentSarga) return
    try { localStorage.setItem(lastSargaKey, String(currentSarga)) } catch { /* private mode */ }
  }, [currentSarga, lastSargaKey])

  if (!kandam) return <ErrorBanner message="This learning content doesn't exist" />

  const prevSarga = currentSarga > 1 ? currentSarga - 1 : null
  const nextSarga = currentSarga < kandam.totalSargas ? currentSarga + 1 : null

  const goTo = (sarga) => navigate(`/learning/ramayanam/${kandamSlug}/${sarga}`)

  const src = pdfUrl(kandamSlug, language, currentSarga)

  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">{kandam.name}</h1>
      <div className="greet-sub">Read sarga by sarga.</div>

      <div className="sk-sarga-nav">
        <button type="button" className="sk-nav-btn" disabled={!prevSarga}
          onClick={() => goTo(prevSarga)} aria-label="Previous sarga">
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <select className="sk-sarga-select" value={currentSarga}
          onChange={(e) => goTo(Number(e.target.value))} aria-label="Jump to sarga">
          {Array.from({ length: kandam.totalSargas }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>Sarga {s}</option>
          ))}
        </select>
        <button type="button" className="sk-nav-btn" disabled={!nextSarga}
          onClick={() => goTo(nextSarga)} aria-label="Next sarga">
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
        title={`${kandam.name} Sarga ${currentSarga} (${language})`} />

      <a className="sk-pdf-attribution" href={src} target="_blank" rel="noopener noreferrer">
        Source: prapatti.com (Sunder Kidāmbi) ↗
      </a>
    </>
  )
}
