import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tierClass } from '../utils/tiers'

const SCOPES = [
  { key: 'week', label: 'Week', scope: 'global', period: 'week' },
  { key: 'month', label: 'Month', scope: 'global', period: 'month' },
  { key: 'friends', label: 'Friends', scope: 'friends', period: 'week' },
  { key: 'kids', label: 'Kids 🧒', scope: 'kids', period: 'week' },
]

export default function SabhaPage() {
  const [tab, setTab] = useState(SCOPES[0])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_leaderboard', { p_period: tab.period, p_scope: tab.scope })
      .then(({ data, error }) => {
        setRows(error ? [] : (data ?? []))
        setLoading(false)
      })
  }, [tab])

  const hall = rows[0]
  const myRow = rows.find(r => r.is_me)
  const myRank = myRow ? rows.indexOf(myRow) + 1 : null
  const initials = (n) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <div className="greet" style={{ fontSize: '1.1rem' }}>
        {tab.key === 'kids' ? 'Bala Sabha' : 'Sabha Leaderboard'}
      </div>
      <div className="greet-sub" style={{ marginBottom: '1rem' }}>
        {tab.period === 'week' ? 'This week · resets Sunday night' : 'This month'}
      </div>

      <div className="seg-toggle">
        {SCOPES.map(s => (
          <button key={s.key} className={`seg ${tab.key === s.key ? 'on' : ''}`}
            onClick={() => setTab(s)}>{s.label}</button>
        ))}
      </div>

      {loading ? <div className="spinner-wrap">Loading...</div> : rows.length === 0 ? (
        <div className="empty-note">
          {tab.key === 'kids'
            ? 'No children in Bala Sabha yet. Opt your child in from the Profile page.'
            : 'No entries yet. Complete an anushtanam to appear here!'}
        </div>
      ) : (
        <>
          {hall && hall.score > 0 && (
            <div className="hall-banner">
              <div className="hall-avatar">{initials(hall.display_name)}</div>
              <div>
                <div className="hall-label">🏅 Hall of the {tab.period === 'month' ? 'Month' : 'Week'}</div>
                <div className="hall-name">{hall.display_name}</div>
                <div className="hall-stat">
                  {hall.score} anushtanams · {hall.streak}-day streak · {hall.tier} tier
                </div>
              </div>
            </div>
          )}
          {rows.map((r, i) => <Row key={r.subject_id} r={r} rank={i + 1} initials={initials} />)}
          {myRow && myRank > rows.length && <Row r={myRow} rank={myRank} initials={initials} />}
        </>
      )}
    </>
  )
}

function Row({ r, rank, initials }) {
  return (
    <div className={`lb-row ${r.is_me ? 'me' : ''}`}>
      <div className={`lb-rank ${rank <= 3 ? `r${rank}` : ''}`}>{rank}</div>
      <div className="lb-avatar">{initials(r.display_name)}</div>
      <div className="lb-body">
        <div className="lb-name">{r.display_name}{r.is_me ? ' (You)' : ''}</div>
        <span className={`tier-badge ${tierClass(r.tier)}`}>{r.tier}</span>
      </div>
      <div className="lb-score">{r.score}<span className="u">🔥 {r.streak}</span></div>
    </div>
  )
}
