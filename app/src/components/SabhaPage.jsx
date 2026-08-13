import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Award, Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { tierClass } from '../utils/tiers'
import ErrorBanner from './ErrorBanner'
import { friendlyError } from '../utils/friendlyError'
import { queryClient, withDeadline, unwrap } from '../lib/queryClient'

const SCOPES = [
  { key: 'week', label: 'Week', scope: 'global', period: 'week' },
  { key: 'month', label: 'Month', scope: 'global', period: 'month' },
  { key: 'kids', label: 'Kids', scope: 'kids', period: 'week' },
]

export default function SabhaPage() {
  const [tab, setTab] = useState(SCOPES[0])
  const { profile } = useAuth()
  const query = useQuery({
    queryKey: ['leaderboard', tab.period, tab.scope],
    enabled: !!profile.community_enabled,
    queryFn: async () => unwrap(await withDeadline(
      supabase.rpc('get_leaderboard', { p_period: tab.period, p_scope: tab.scope }),
      'Sabha leaderboard',
    )) ?? [],
  }, queryClient)
  const rows = query.data ?? []
  const error = query.error ? friendlyError(query.error) : ''

  // Community is opt-in (default hidden) - the nav tab is already gone when
  // disabled (Layout.jsx), but the route is still reachable directly, so
  // gate the content here too rather than showing a stale/empty board.
  if (!profile.community_enabled) {
    return (
      <div className="referral-card">
        <div className="ref-title">Community is hidden</div>
        <div className="ref-sub">
          Sabha compares streaks and punya with other members. It's off by default -
          turn it on from your Profile if you'd like to see it.
        </div>
        <Link to="/profile" className="btn-ref" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Go to Profile
        </Link>
      </div>
    )
  }

  const hall = rows[0]
  const myRow = rows.find(r => r.is_me)
  const myRank = myRow ? rows.indexOf(myRow) + 1 : null
  const initials = (n) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <h1 className="greet" style={{ fontSize: '1.1rem' }}>
        {tab.key === 'kids' ? 'Bala Sabha' : 'Sabha Leaderboard'}
      </h1>
      <div className="greet-sub" style={{ marginBottom: '1rem' }}>
        {tab.period === 'week' ? 'This week · resets Sunday night' : 'This month'}
      </div>

      <div className="seg-toggle">
        {SCOPES.map(s => (
          <button key={s.key} className={`seg ${tab.key === s.key ? 'on' : ''}`}
            onClick={() => setTab(s)}>{s.label}</button>
        ))}
      </div>

      {query.isPending ? <div className="spinner-wrap">Loading...</div> : error && !rows.length ? (
        <ErrorBanner message={error} onRetry={() => query.refetch()} />
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
                <div className="hall-label"><Award size={12} strokeWidth={2.5} /> Hall of the {tab.period === 'month' ? 'Month' : 'Week'}</div>
                <div className="hall-name">{hall.display_name}</div>
                <div className="hall-stat">
                  {hall.score} anushtanams · {hall.streak}-day streak · {hall.tier} tier
                </div>
              </div>
            </div>
          )}
          {rows.map((r, i) => <Row key={r.subject_id} r={r} rank={i + 1} initials={initials} />)}
          {myRow && myRank > rows.length && <Row r={myRow} rank={myRank} initials={initials} />}
          {query.isFetching && <div className="greet-sub" role="status">Refreshing...</div>}
          {error && <ErrorBanner message={error} onRetry={() => query.refetch()} />}
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
      <div className="lb-score">{r.score}<span className="u"><Flame size={9} strokeWidth={2.5} /> {r.streak}</span></div>
    </div>
  )
}
