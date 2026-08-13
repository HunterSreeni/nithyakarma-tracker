import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import ProfileSwitcher from './ProfileSwitcher'
import ErrorBanner from './ErrorBanner'
import PracticeIcon from '../utils/practiceIcons'
import { friendlyError } from '../utils/friendlyError'
import { readHistoryCache, writeHistoryCache } from '../utils/historyCache'
import { queryClient, withDeadline, unwrap } from '../lib/queryClient'

export default function HistoryPage() {
  const { session, selectedMember } = useAuth()
  const ownerId = session.user.id
  const memberId = selectedMember?.id ?? null
  const query = useQuery({
    queryKey: ['history', ownerId, memberId ?? 'self'],
    initialData: () => readHistoryCache(ownerId, memberId) ?? undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      let q = supabase.from('user_practices')
        .select('id, practice:practices(name, slug, is_sandhyavandhanam, is_sri_rudram)')
        .eq('owner_id', ownerId)
      q = selectedMember ? q.eq('family_member_id', selectedMember.id) : q.is('family_member_id', null)
      const ups = unwrap(await withDeadline(q, 'History practices')) ?? []
      const byUp = Object.fromEntries((ups ?? []).map(u => [u.id, u.practice]))
      const ids = Object.keys(byUp)
      if (!ids.length) {
        writeHistoryCache(ownerId, memberId, [])
        return []
      }
      const logs = unwrap(await withDeadline(supabase.from('practice_logs')
        .select('user_practice_id, log_date, slot')
        .in('user_practice_id', ids)
        .order('log_date', { ascending: false })
        .limit(300), 'History logs')) ?? []
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
      writeHistoryCache(ownerId, memberId, resolved)
      return resolved
    },
  }, queryClient)
  const days = query.data ?? []
  const error = query.error ? friendlyError(query.error) : ''

  return (
    <>
      <h1 className="greet" style={{ fontSize: '1.1rem' }}>History</h1>
      <ProfileSwitcher />
      <div style={{ marginTop: '1rem' }}>
        {query.isPending ? <div className="spinner-wrap">Loading...</div> : error && !days.length ? (
          <ErrorBanner message={error} onRetry={() => query.refetch()} />
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
                <span className="history-item" key={`${p.slug ?? p.name}-${i}`}>
                  {i > 0 && <span className="history-sep">·</span>}
                  <PracticeIcon slug={p.slug} size={12} strokeWidth={2} />
                  {p.name}{p.is_sandhyavandhanam ? ` (${slots}/3 sandhyas)`
                    : p.is_sri_rudram ? ` (${slots} rudram mark${slots === 1 ? '' : 's'})` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
        {query.isFetching && !query.isPending && <div className="greet-sub" role="status">Refreshing...</div>}
        {error && days.length > 0 && <ErrorBanner message={error} onRetry={() => query.refetch()} />}
      </div>
    </>
  )
}
