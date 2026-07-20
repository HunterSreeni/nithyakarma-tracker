import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { LEARNING_CONTENT } from './LearningPage'

export default function LearningHub() {
  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">Read along</h1>
      <div className="greet-sub">Pick a practice to read in the language you read best.</div>

      <div className="verse-list">
        {Object.entries(LEARNING_CONTENT).map(([slug, meta]) => (
          <Link key={slug} to={`/learning/${slug}`} className="verse-card">
            <div className="v-body">
              <div className="verse-type">{meta.title}</div>
              <div className="verse-text">{meta.subtitle}</div>
            </div>
            <ChevronRight size={18} strokeWidth={2.5} />
          </Link>
        ))}
      </div>
    </>
  )
}
