import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Languages, CirclePlay } from 'lucide-react'
import { useLearning } from '../hooks/useLearning'
import ErrorBanner from './ErrorBanner'

// Reading only - completion is marked from the Today page like any other
// practice, not verse by verse from here. A verse-by-verse "Mark Learned"
// button used to double as a second, redundant way to log the practice.
export const LEARNING_CONTENT = {
  'hanuman-chalisa': {
    title: 'Hanuman Chalisa',
    subtitle: 'Read along, in the language you read best.',
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { doha: 'Doha', chaupai: 'Chaupai' },
    youtubeUrl: 'https://www.youtube.com/watch?v=sX2bYV6nSy4',
  },
  'vishnu-sahasranamam': {
    title: 'Vishnu Sahasranamam',
    subtitle: 'The 1000 names of Vishnu, read along in the language you read best.',
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { dhyanam: 'Dhyanam', shloka: 'Shloka' },
    youtubeUrl: 'https://www.youtube.com/watch?v=5aHeprNOU3s',
  },
  // The full Ramayanam (6 kandams, hundreds of sargas each) is too large for
  // this flat-list reader - its own route (/learning/ramayanam) goes to the
  // kandam picker (RamayanamPage) instead, which leads to the sarga-aware
  // KandamPage. This entry only feeds the LearningHub card; LearningPage
  // itself never renders for this slug.
  ramayanam: {
    title: 'Ramayanam',
    subtitle: 'Read Valmiki’s Ramayanam, kandam by kandam.',
  },
}

export default function LearningPage() {
  const { slug } = useParams()
  const meta = LEARNING_CONTENT[slug]
  const { verses, loading, error: loadError } = useLearning(slug)
  const [language, setLanguage] = useState(meta?.languages[0]?.key ?? 'english')

  if (!meta) return <ErrorBanner message="This learning content doesn't exist" />

  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">{meta.title}</h1>
      <div className="greet-sub">{meta.subtitle}</div>

      <a className="btn-youtube" href={meta.youtubeUrl} target="_blank" rel="noopener noreferrer">
        <CirclePlay size={16} strokeWidth={2.5} /> Watch on YouTube
      </a>

      <div className="lang-select" role="group" aria-label="Language">
        <Languages size={14} strokeWidth={2.5} />
        {meta.languages.map(l => (
          <button key={l.key} type="button"
            className={`lang-btn ${language === l.key ? 'on' : ''}`}
            aria-pressed={language === l.key}
            onClick={() => setLanguage(l.key)}>
            {l.label}
          </button>
        ))}
      </div>

      {loading ? <div className="spinner-wrap">Loading...</div> : loadError ? (
        <ErrorBanner message={loadError} />
      ) : (
        <div className="verse-list">
          {verses.map(v => (
            <div key={v.id} className="verse-card">
              <div className="v-body">
                <div className="verse-type">{meta.typeLabel[v.type] ?? v.type}</div>
                <div className="verse-text">{v[language]}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
