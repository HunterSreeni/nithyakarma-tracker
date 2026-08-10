import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isScheduled, localDateString } from '../utils/cadence'
import { friendlyError } from '../utils/friendlyError'
import { suppressTodayNudgesIfScheduled } from '../utils/notifications'
import { readTodayCache, writeTodayCache } from '../utils/todayCache'

// Loads the selected subject's practices + today's logs.
// Streaks/punya are maintained server-side by submit_practice_log.
export function useToday(ownerId, familyMemberId = null) {
  const [items, setItems] = useState([]) // [{ up, practice, logs }]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // fromCache is passed only by the mount effect. Refreshes after a mark must
  // NOT seed from the cache: it still holds the pre-mark logs, so the tick the
  // user just earned would flash back off before the fetch corrects it.
  const load = useCallback(async ({ fromCache = false } = {}) => {
    if (!ownerId) return
    setError('')
    const cached = fromCache ? readTodayCache(ownerId, familyMemberId) : null
    if (cached) setItems(cached)
    setLoading(!cached)
    try {
      let q = supabase.from('user_practices')
        .select('*, practice:practices(*)')
        .eq('owner_id', ownerId)
      q = familyMemberId ? q.eq('family_member_id', familyMemberId) : q.is('family_member_id', null)
      const { data: ups } = await q
      const today = localDateString()
      const ids = (ups ?? []).map(u => u.id)
      let logs = []
      if (ids.length) {
        const { data } = await supabase.from('practice_logs')
          .select('*').in('user_practice_id', ids).eq('log_date', today)
        logs = data ?? []
      }
      const scheduled = (ups ?? [])
        .filter(u => isScheduled(u.practice))
        .map(u => ({ up: u, practice: u.practice, logs: logs.filter(l => l.user_practice_id === u.id) }))
        .sort((a, b) => (b.practice.is_sandhyavandhanam ? 1 : 0) - (a.practice.is_sandhyavandhanam ? 1 : 0))
      setItems(scheduled)
      writeTodayCache(ownerId, familyMemberId, scheduled)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [ownerId, familyMemberId])

  useEffect(() => { load({ fromCache: true }) }, [load])

  // The core write path. Returns the verified server response - the caller
  // shows celebration/ad ONLY from this result.
  const submit = async (userPracticeId, { slot = null, count = null, awardStreak = true } = {}) => {
    const { data, error } = await supabase.rpc('submit_practice_log', {
      p_user_practice_id: userPracticeId, p_slot: slot, p_count: count,
      p_local_date: localDateString(), p_award_streak: awardStreak,
    })
    if (error) throw error
    if (!data?.saved) throw new Error('Save could not be verified')
    if (data.day_complete) suppressTodayNudgesIfScheduled().catch(() => {})
    await load()
    return data
  }

  const addPractice = async (practiceId) => {
    const { error } = await supabase.from('user_practices').insert({
      owner_id: ownerId, family_member_id: familyMemberId, practice_id: practiceId,
    })
    if (error) throw error
    await load()
  }

  return { items, loading, error, submit, addPractice, reload: load }
}
