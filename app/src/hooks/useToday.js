import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, withDeadline, unwrap } from '../lib/queryClient'
import { isScheduled, localDateString } from '../utils/cadence'
import { friendlyError } from '../utils/friendlyError'
import { suppressTodayNudgesIfScheduled } from '../utils/notifications'
import { readTodayCache, writeTodayCache } from '../utils/todayCache'

async function fetchToday(ownerId, familyMemberId) {
  let practicesQuery = supabase.from('user_practices')
    .select('*, practice:practices(*)')
    .eq('owner_id', ownerId)
  practicesQuery = familyMemberId
    ? practicesQuery.eq('family_member_id', familyMemberId)
    : practicesQuery.is('family_member_id', null)

  const ups = unwrap(await withDeadline(practicesQuery, 'Today practices')) ?? []
  const ids = ups.map(item => item.id)
  let logs = []
  if (ids.length) {
    logs = unwrap(await withDeadline(
      supabase.from('practice_logs').select('*').in('user_practice_id', ids).eq('log_date', localDateString()),
      'Today logs',
    )) ?? []
  }

  const scheduled = ups
    .filter(item => isScheduled(item.practice))
    .map(item => ({
      up: item,
      practice: item.practice,
      logs: logs.filter(log => log.user_practice_id === item.id),
    }))
    .sort((a, b) => (b.practice.is_sandhyavandhanam ? 1 : 0) - (a.practice.is_sandhyavandhanam ? 1 : 0))
  writeTodayCache(ownerId, familyMemberId, scheduled)
  return scheduled
}

// Today keeps cached content visible while a bounded live refresh runs. Query
// focus/reconnect events are coordinated by lib/dataLifecycle.js.
export function useToday(ownerId, familyMemberId = null) {
  const query = useQuery({
    queryKey: ['today', ownerId, familyMemberId ?? 'self', localDateString()],
    enabled: !!ownerId,
    queryFn: () => fetchToday(ownerId, familyMemberId),
    initialData: () => ownerId ? readTodayCache(ownerId, familyMemberId) ?? undefined : undefined,
    initialDataUpdatedAt: 0,
  }, queryClient)

  const reload = async () => {
    const result = await query.refetch()
    if (result.error) throw result.error
    return result.data
  }

  const submit = async (userPracticeId, { slot = null, count = null, awardStreak = true } = {}) => {
    const result = await withDeadline(supabase.rpc('submit_practice_log', {
      p_user_practice_id: userPracticeId, p_slot: slot, p_count: count,
      p_local_date: localDateString(), p_award_streak: awardStreak,
    }), 'Save practice')
    const data = unwrap(result)
    if (!data?.saved) throw new Error('Save could not be verified')
    if (data.day_complete) suppressTodayNudgesIfScheduled().catch(() => {})
    await reload()
    return data
  }

  const addPractice = async (practiceId) => {
    unwrap(await withDeadline(supabase.from('user_practices').insert({
      owner_id: ownerId, family_member_id: familyMemberId, practice_id: practiceId,
    }), 'Add practice'))
    await reload()
  }

  return {
    items: query.data ?? [],
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error ? friendlyError(query.error) : '',
    submit,
    addPractice,
    reload,
  }
}
