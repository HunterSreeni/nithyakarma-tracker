import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import ProfileSwitcher from './ProfileSwitcher'

export default function HistoryPage() {
  const { session, selectedMember } = useAuth()
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      let q = supabase.from('user_practices')
        .select('id, practice:practices(name, icon, is_sandhyavandhanam)')
        .eq('owner_id', session.user.id)
      q = selectedMember ? q.eq('family_member_id', selectedMember.id) : q.is('family_member_id', null)
      const { data: ups } = await q
      const byUp = Object.fromEntries((ups ?? []).map(u => [u.id, u.practice]))
      const ids = Object.keys(byUp)
      if (!ids.length) { setDays([]); setLoading(false); return }
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
      setDays(Object.entries(grouped).map(([date, ls]) => ({
        date,
        items: Object.values(ls.reduce((acc, l) => {
          const p = byUp[l.user_practice_id]
          acc[l.user_practice_id] ??= { p, slots: 0 }
          acc[l.user_practice_id].slots += 1
          return acc
        }, {})),
      })))
      setLoading(false)
    })()
  }, [session.user.id, selectedMember])

  return (
    <>
      <div className="greet" style={{ fontSize: '1.1rem' }}>History</div>
      <ProfileSwitcher />
      <div style={{ marginTop: '1rem' }}>
        {loading ? <div className="spinner-wrap">Loading...</div> : days.length === 0 ? (
          <div className="empty-note">No anushtanams logged yet.</div>
        ) : days.map(d => (
          <div className="history-row" key={d.date}>
            <div className="history-date">
              {new Date(d.date + 'T00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              })}
            </div>
            <div className="history-items">
              {d.items.map(({ p, slots }) =>
                `${p.icon} ${p.name}${p.is_sandhyavandhanam ? ` (${slots}/3 sandhyas)` : ''}`,
              ).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
