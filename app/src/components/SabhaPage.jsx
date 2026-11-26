import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Award, Flame, MoreHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { tierClass } from '../utils/tiers'
import ErrorBanner from './ErrorBanner'
import { friendlyError } from '../utils/friendlyError'
import { queryClient, withDeadline, unwrap } from '../lib/queryClient'
import { getHiddenNames, hideName, showAllNames } from '../utils/sabhaHidden'
import SabhaReportModal from './SabhaReportModal'

const SCOPES = [
  { key: 'week', label: 'Week', scope: 'global', period: 'week' },
  { key: 'month', label: 'Month', scope: 'global', period: 'month' },
  { key: 'kids', label: 'Kids', scope: 'kids', period: 'week' },
]

export default function SabhaPage() {
  const [tab, setTab] = useState(SCOPES[0])
  const { profile } = useAuth()
  const query = useQuery({
    // AI-DEV NOTE: keyed by the viewer - get_leaderboard's rows depend on who
    // asks (own row, opt-in), so a shared device must never reuse another
    // account's cached board. useAuth invalidates ['leaderboard'] after marks,
    // profile and family changes.
    queryKey: ['leaderboard', profile.id, tab.period, tab.scope],
    enabled: !!profile.community_enabled,
    queryFn: async () => unwrap(await withDeadline(
      supabase.rpc('get_leaderboard', { p_period: tab.period, p_scope: tab.scope }),
      'Sabha leaderboard',
    )) ?? [],
  }, queryClient)
  const [hidden, setHidden] = useState([])
  const [reporting, setReporting] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let live = true
    getHiddenNames(profile.id).then(list => { if (live) setHidden(list) })
    return () => { live = false }
  }, [profile.id])
  // Your own rows (you, your children) are never hidden. Hiding only removes a
  // row from view: ranks and the Hall stay the server's, so allRows keeps them.
  const allRows = query.data ?? []
  const rows = allRows.filter(r => r.is_me || !hidden.includes(r.subject_id))
  const hiddenCount = allRows.length - rows.length
  const onHide = async (subjectId, how) => {
    setHidden(await hideName(profile.id, subjectId))
    setReporting(null)
    setNotice(how === 'reported' ? "Reported. Thank you - we'll review it." : 'Hidden from your Sabha.')
  }
  const showAll = async () => {
    setHidden(await showAllNames(profile.id))
    setNotice('')
  }
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

  const hall = rows.includes(allRows[0]) ? allRows[0] : null
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
          {rows.map(r => <Row key={r.subject_id} r={r} rank={allRows.indexOf(r) + 1} initials={initials} onMore={setReporting} />)}
          {query.isFetching && <div className="greet-sub" role="status">Refreshing...</div>}
          {error && <ErrorBanner message={error} onRetry={() => query.refetch()} />}
        </>
      )}
      {notice && <div className="greet-sub" role="status">{notice}</div>}
      {hiddenCount > 0 && (
        <div className="greet-sub">
          Hidden names: {hiddenCount} <button type="button" className="btn-plain sabha-show-all" onClick={showAll}>Show</button>
        </div>
      )}
      {reporting && <SabhaReportModal row={reporting} onClose={() => setReporting(null)} onHide={onHide} />}
    </>
  )
}

function Row({ r, rank, initials, onMore }) {
  return (
    <div className={`lb-row ${r.is_me ? 'me' : ''}`}>
      <div className={`lb-rank ${rank <= 3 ? `r${rank}` : ''}`}>{rank}</div>
      <div className="lb-avatar">{initials(r.display_name)}</div>
      <div className="lb-body">
        <div className="lb-name">{r.display_name}{r.is_me ? ' (You)' : ''}</div>
        <span className={`tier-badge ${tierClass(r.tier)}`}>{r.tier}</span>
      </div>
      <div className="lb-score">{r.score}<span className="u"><Flame size={9} strokeWidth={2.5} /> {r.streak}</span></div>
      {!r.is_me && (
        <button type="button" className="lb-more" aria-label={`Report or hide ${r.display_name}`} onClick={() => onMore(r)}>
          <MoreHorizontal size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
