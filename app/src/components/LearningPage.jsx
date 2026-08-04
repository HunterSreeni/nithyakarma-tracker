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
  'sai-baba-aarti': {
    title: 'Sai Baba Aarti',
    subtitle: 'Thursday (Guruvar) is Sai Baba’s day - the aarti sung at Shirdi.',
    languages: [
      { key: 'english', label: 'English' },
    ],
    typeLabel: { refrain: 'Refrain', stanza: 'Stanza' },
    youtubeUrl: 'https://www.youtube.com/watch?v=UpYEUdZBNRo',
  },
  'lalitha-sahasranamam': {
    title: 'Lalitha Sahasranamam',
    subtitle: 'The 1000 names of Lalitha Devi, in Sanskrit.',
    languages: [
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { dhyanam: 'Dhyanam', shloka: 'Shloka' },
    youtubeUrl: 'https://www.youtube.com/watch?v=zgG-gjioU1g',
  },
  'soundarya-lahari': {
    title: 'Soundarya Lahari',
    subtitle: "Adi Shankaracharya's 100 verses in praise of the Devi, read along in the language you read best.",
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { anandalahari: 'Ananda Lahari', soundaryalahari: 'Soundarya Lahari' },
    youtubeUrl: 'https://www.youtube.com/watch?v=RKEKnVyaDl0',
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
  // Devi Mahatmyam (13 chapters) is also too large for this flat-list
  // reader - its own route (/learning/devi-mahatmyam) goes straight to
  // DeviMahatmyamPage (no picker page needed, unlike Ramayanam, since it's
  // a single work rather than several kandams). LearningPage itself never
  // renders for this slug.
  'devi-mahatmyam': {
    title: 'Devi Mahatmyam',
    subtitle: 'Read the Durga Saptashati, chapter by chapter.',
  },
  'dakshinamurthy-stotram': {
    title: 'Dakshinamurthy Stotram',
    subtitle: "Adi Shankaracharya's hymn to Shiva as the silent Guru, read along in the language you read best.",
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { shantipatha: 'Shanti Patha', dhyanam: 'Dhyanam', stotram: 'Stotram' },
  },
  'aditya-hrudayam': {
    title: 'Aditya Hrudayam',
    subtitle: 'Agastya’s hymn to Surya, recited to Rama before his battle with Ravana, read along in the language you read best.',
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { dhyanam: 'Dhyanam', shloka: 'Shloka' },
  },
  'subrahmanya-bhujangam': {
    title: 'Subrahmanya Bhujangam',
    subtitle: "Adi Shankaracharya's hymn to Subrahmanya, composed at Tiruchendur, read along in the language you read best.",
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { shloka: 'Shloka' },
  },
  mukundamala: {
    title: 'Mukundamala',
    subtitle: "Kulasekhara Alwar's garland of verses to Krishna, read along in the language you read best.",
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { shloka: 'Shloka' },
  },
  'sri-rudram': {
    title: 'Sri Rudram',
    subtitle: 'The Namakam and Chamakam of the Krishna Yajurveda, anuvaka by anuvaka, read along in the language you read best.',
    languages: [
      { key: 'english', label: 'English' },
      { key: 'malayalam', label: 'Malayalam' },
      { key: 'tamil', label: 'Tamil' },
      { key: 'sanskrit', label: 'Sanskrit' },
    ],
    typeLabel: { anuvaka: 'Anuvaka', closing: 'Closing' },
  },
  // Video-only (no `languages`) - Rigveda, Yajurveda, Samaveda and
  // Atharvaveda each have genuinely different mantras/procedure for both of
  // these, and no single text can honestly stand in for all four. A full
  // per-Veda switcher is real future work (see docs/ROADMAP.md), so for now
  // this is a watch-along video rather than an incomplete or wrong-Veda
  // reading text.
  sandhyavandhanam: {
    title: 'Sandhyavandhanam',
    subtitle: 'Watch the Yajurveda Trikala Sandhyavandanam procedure, with English instructions.',
    youtubeUrl: 'https://www.youtube.com/watch?v=gNojvhazzQU',
  },
  samidhadhanam: {
    title: 'Samidhadhanam',
    subtitle: 'Watch the Yajurveda Samidhadhanam (Agnikaryam) procedure, with English instructions.',
    youtubeUrl: 'https://www.youtube.com/watch?v=8vq5Chkx2Mw',
  },
}

export default function LearningPage() {
  const { slug } = useParams()
  const meta = LEARNING_CONTENT[slug]
  const hasVerses = (meta?.languages?.length ?? 0) > 0
  const { verses, loading, error: loadError } = useLearning(hasVerses ? slug : null)
  const [language, setLanguage] = useState(meta?.languages?.[0]?.key ?? 'english')

  if (!meta) return <ErrorBanner message="This learning content doesn't exist" />

  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">{meta.title}</h1>
      <div className="greet-sub">{meta.subtitle}</div>

      {meta.youtubeUrl && (
        <a className="btn-youtube" href={meta.youtubeUrl} target="_blank" rel="noopener noreferrer">
          <CirclePlay size={16} strokeWidth={2.5} /> Watch on YouTube
        </a>
      )}

      {hasVerses && (
        <>
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
      )}
    </>
  )
}
