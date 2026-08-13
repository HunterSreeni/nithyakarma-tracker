import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { withDeadline, unwrap } from '../lib/queryClient'
import { localDateString } from '../utils/cadence'
import { addDays, matchingRules } from '../../supabase/functions/_shared/observanceMatch.ts'

const DISMISS_PREFIX = 'nk_dismissed_observance_'

function bannerMatches(rows, rules, date) {
  const rowByDate = new Map(rows.map((row) => [row.date, row]))
  const matches = matchingRules({
    [-1]: rowByDate.get(addDays(date, -1)),
    0: rowByDate.get(date),
    1: rowByDate.get(addDays(date, 1)),
  }, rules)

  // A named rule supersedes its generic monthly rule in the same category.
  // A genuinely separate occasion from the other category can be mentioned.
  const seenCategories = new Set()
  return matches.filter((match) => {
    if (seenCategories.has(match.category)) return false
    seenCategories.add(match.category)
    return true
  })
}

function secondaryText(primary, secondary) {
  if (!secondary) return ''
  const primaryCopy = `${primary.title} ${primary.message}`.toLocaleLowerCase()
  if (primaryCopy.includes(secondary.title.toLocaleLowerCase())) return ''
  return ` Also today: ${secondary.message}`
}

export default function ObservanceBanner() {
  const date = localDateString()
  const [dismissedKey, setDismissedKey] = useState(null)
  const { data: matches = [] } = useQuery({
    queryKey: ['observance-banner', date],
    queryFn: async () => {
      const dates = [addDays(date, -1), date, addDays(date, 1)]
      const [daysResult, rulesResult] = await withDeadline(Promise.all([
        supabase.from('panchangam_days')
          .select('date, thithi, tamil_month, tamil_day, malayalam_month, malayalam_day, nakshatra')
          .in('date', dates),
        supabase.from('panchangam_observances').select('*'),
      ]), 'Today observances')
      return bannerMatches(unwrap(daysResult) ?? [], unwrap(rulesResult) ?? [], date)
    },
  })

  const primary = matches[0]
  if (!primary) return null
  const storageKey = `${DISMISS_PREFIX}${date}_${primary.key}`
  let storedDismissal = false
  try { storedDismissal = localStorage.getItem(storageKey) === '1' } catch { /* private mode */ }
  if (storedDismissal || dismissedKey === storageKey) return null

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1') } catch { /* private mode */ }
    setDismissedKey(storageKey)
  }

  return (
    <div className="monthly-special monthly-special-static" data-observance-key={primary.key}>
      <div>
        <div className="ms-title">{primary.title}</div>
        <div className="ms-subtitle">{primary.message}{secondaryText(primary, matches[1])}</div>
      </div>
      <button type="button" className="ms-dismiss" aria-label="Dismiss" onClick={dismiss}>
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
