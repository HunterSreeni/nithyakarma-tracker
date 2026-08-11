import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import ProfileSwitcher from './ProfileSwitcher'
import ErrorBanner from './ErrorBanner'
import PracticeIcon from '../utils/practiceIcons'
import { friendlyError } from '../utils/friendlyError'
import { readHistoryCache, writeHistoryCache } from '../utils/historyCache'

export default function HistoryPage() {
  const { session, selectedMember } = useAuth()
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // fromCache is passed only by the mount effect, so a manual retry always
  // shows a real spinner rather than re-painting the same stale list.
  const load = useCallback(async ({ fromCache = false } = {}) => {
    setError('')
    const cached = fromCache ? readHistoryCache(session.user.id, selectedMember?.id) : null
    if (cached) setDays(cached)
    setLoading(!cached)
    try {
      let q = supabase.from('user_practices')
        .select('id, practice:practices(name, slug, is_sandhyavandhanam, is_sri_rudram)')
        .eq('owner_id', session.user.id)
      q = selectedMember ? q.eq('family_member_id', selectedMember.id) : q.is('family_member_id', null)
      const { data: ups } = await q
      const byUp = Object.fromEntries((ups ?? []).map(u => [u.id, u.practice]))
      const ids = Object.keys(byUp)
      if (!ids.length) {
        setDays([])
        writeHistoryCache(session.user.id, selectedMember?.id, [])
        return
      }
      const { data: logs } = await supabase.from('practice_logs')
        .select('user_practice_id, log_date, slot')
        .in('user_practice_id', ids)
        .order('log_date', { ascending: false })
        .limit(300)
      const grouped = {}
      for (const l of logs ?? []) {
        grouped[l.log_date] ??= []
        grouped[l.log_date].push(l)
      }
      const resolved = Object.entries(grouped).map(([date, ls]) => ({
        date,
        items: Object.values(ls.reduce((acc, l) => {
          const p = byUp[l.user_practice_id]
          acc[l.user_practice_id] ??= { p, slots: 0 }
          acc[l.user_practice_id].slots += 1
          return acc
        }, {})),
      }))
      setDays(resolved)
      writeHistoryCache(session.user.id, selectedMember?.id, resolved)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [session.user.id, selectedMember])

  useEffect(() => { load({ fromCache: true }) }, [load])

  return (
    <>
      <h1 className="greet" style={{ fontSize: '1.1rem' }}>History</h1>
      <ProfileSwitcher />
      <div style={{ marginTop: '1rem' }}>
        {loading ? <div className="spinner-wrap">Loading...</div> : error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : days.length === 0 ? (
          <div className="empty-note">No anushtanams logged yet.</div>
        ) : days.map(d => (
          <div className="history-row" key={d.date}>
            <div className="history-date">
              {new Date(d.date + 'T00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              })}
            </div>
            <div className="history-items">
              {d.items.map(({ p, slots }, i) => (
                <span className="history-item" key={p.slug}>
                  {i > 0 && <span className="history-sep">·</span>}
                  <PracticeIcon slug={p.slug} size={12} strokeWidth={2} />
                  {p.name}{p.is_sandhyavandhanam ? ` (${slots}/3 sandhyas)`
                    : p.is_sri_rudram ? ` (${slots} rudram mark${slots === 1 ? '' : 's'})` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
