import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { tierClass } from '../utils/tiers'
import { shareUrl } from '../utils/share'
import { track } from '../utils/analytics'
import ErrorBanner from './ErrorBanner'
import { friendlyError } from '../utils/friendlyError'

const SCOPES = [
  { key: 'week', label: 'Week', scope: 'global', period: 'week' },
  { key: 'month', label: 'Month', scope: 'global', period: 'month' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'kids', label: 'Kids 🧒', scope: 'kids', period: 'week' },
]

export default function SabhaPage() {
  const [tab, setTab] = useState(SCOPES[0])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { profile } = useAuth()

  const isReferrals = tab.key === 'referrals'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = tab.key === 'referrals'
        ? await supabase.rpc('get_my_referrals')
        : await supabase.rpc('get_leaderboard', { p_period: tab.period, p_scope: tab.scope })
      if (rpcError) throw rpcError
      setRows(data ?? [])
    } catch (err) {
      // A real failure used to be disguised as an empty leaderboard - now it
      // surfaces as an error with a retry instead of a misleading empty state.
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const hall = rows[0]
  const myRow = rows.find(r => r.is_me)
  const myRank = myRow ? rows.indexOf(myRow) + 1 : null
  const initials = (n) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  // With no referrals yet, guide the user to invite instead of an empty list.
  const noReferrals = isReferrals && rows.length === 0
  const inviteWhatsApp = () => {
    track('share_clicked', { from: 'sabha_referrals' })
    const text = `Join me on Nithyakarma - track your daily anushtanams with the Sabha!\n${shareUrl(profile.referral_code)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <>
      <h1 className="greet" style={{ fontSize: '1.1rem' }}>
        {tab.key === 'kids' ? 'Bala Sabha' : isReferrals ? 'Your Referrals' : 'Sabha Leaderboard'}
      </h1>
      <div className="greet-sub" style={{ marginBottom: '1rem' }}>
        {isReferrals ? 'People who joined with your link' : tab.period === 'week' ? 'This week · resets Sunday night' : 'This month'}
      </div>

      <div className="seg-toggle">
        {SCOPES.map(s => (
          <button key={s.key} className={`seg ${tab.key === s.key ? 'on' : ''}`}
            onClick={() => setTab(s)}>{s.label}</button>
        ))}
      </div>

      {loading ? <div className="spinner-wrap">Loading...</div> : error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : noReferrals ? (
        <div className="referral-card">
          <div className="ref-title">Your referrals will appear here 🎁</div>
          <div className="ref-sub">
            Invite people with your link. When they join, they'll show up here -
            and you'll both get a month ad-free.
          </div>
          <button className="btn-ref" onClick={inviteWhatsApp}>Invite on WhatsApp</button>
        </div>
      ) : isReferrals ? (
        <>
          {rows.map(r => <ReferralRow key={r.referred_id} r={r} initials={initials} />)}
        </>
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

function ReferralRow({ r, initials }) {
  const joined = new Date(r.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="ref-row">
      <div className="lb-avatar">{initials(r.display_name)}</div>
      <div className="lb-body">
        <div className="lb-name">{r.display_name}</div>
        <div className="ref-row-meta">Joined {joined}</div>
      </div>
      <div className="ref-row-tag">🎁 +1 mo</div>
    </div>
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
