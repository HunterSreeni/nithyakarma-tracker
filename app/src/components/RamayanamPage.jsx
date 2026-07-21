import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { KANDAMS } from '../utils/ramayanam'

// Kandam picker between the Learning hub and the sarga-by-sarga PDF reader
// (KandamPage.jsx) - Ramayanam is too large for a flat list of practices,
// so it gets its own single Learning hub entry that opens this instead.
export default function RamayanamPage() {
  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">Ramayanam</h1>
      <div className="greet-sub" style={{ marginBottom: '1rem' }}>Pick a kandam to read.</div>

      <div className="verse-list">
        {KANDAMS.map((k) => (
          <Link key={k.slug} to={`/learning/ramayanam/${k.slug}`} className="verse-card">
            <div className="v-body">
              <div className="verse-type">{k.name}</div>
              <div className="verse-text">{k.totalSargas} sargas</div>
            </div>
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        ))}
      </div>
    </>
  )
}
