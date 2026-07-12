import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { tierClass } from '../utils/tiers'
import { shareUrl } from '../utils/share'
import { track } from '../utils/analytics'

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
  const { profile } = useAuth()

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
  // "Friends" are your referral connections. With none yet, guide the user to
  // invite instead of showing a lonely one-person board.
  const noFriends = tab.key === 'friends' && rows.filter(r => !r.is_me).length === 0
  const inviteWhatsApp = () => {
    track('share_clicked', { from: 'sabha_friends' })
    const text = `🪔 Join me on Nithyakarma - track your daily anushtanams with the Sabha!\n${shareUrl(profile.referral_code)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

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

      {loading ? <div className="spinner-wrap">Loading...</div> : noFriends ? (
        <div className="referral-card">
          <div className="ref-title">Your Sabha grows with friends 🎁</div>
          <div className="ref-sub">
            Invite friends with your link. When they join, you'll both appear here -
            and you each get a freeze plus a month ad-free.
          </div>
          <button className="btn-ref" onClick={inviteWhatsApp}>Invite on WhatsApp</button>
        </div>
      ) : rows.length === 0 ? (
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
