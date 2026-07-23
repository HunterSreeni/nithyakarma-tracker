// Pure matcher for panchangam_observances rules against panchangam_days rows.
// Isolated as a pure function (no Supabase client, no I/O) so it's unit
// testable independent of the Deno.serve handler - same reasoning as why
// is_scheduled/streak_after_completion are pure functions elsewhere.

export interface ObservanceRule {
  key: string
  category: "tharpanam" | "observance"
  title: string
  message: string
  match_thithi: string | null
  match_tamil_month: string | null
  match_tamil_day: number | null
  match_malayalam_month: string | null
  match_malayalam_day: number | null
  match_nakshatra: string | null
  day_offset: number
  priority: number
}

export interface PanchangamRow {
  thithi: string
  tamil_month: string
  tamil_day: number
  malayalam_month: string
  malayalam_day: number
  nakshatra: string
}

function ruleMatches(rule: ObservanceRule, row: PanchangamRow | undefined): boolean {
  if (!row) return false
  if (rule.match_thithi != null && rule.match_thithi !== row.thithi) return false
  if (rule.match_tamil_month != null && rule.match_tamil_month !== row.tamil_month) return false
  if (rule.match_tamil_day != null && rule.match_tamil_day !== row.tamil_day) return false
  if (rule.match_malayalam_month != null && rule.match_malayalam_month !== row.malayalam_month) return false
  if (rule.match_malayalam_day != null && rule.match_malayalam_day !== row.malayalam_day) return false
  if (rule.match_nakshatra != null && rule.match_nakshatra !== row.nakshatra) return false
  return true
}

// rowsByOffset maps a rule's day_offset to the panchangam_days row that many
// days ahead of the candidate date (0 = the candidate date itself). day_offset
// can be positive OR negative:
//   +1 - a night observance (e.g. Maha Sivarathri, Vijayadashami): the tithi
//        begins in the evening, so the printed-panchangam day is the day
//        BEFORE the noon-sampled thithi's own day - check tomorrow's row.
//   -1 - a pre-dawn observance (e.g. Naraka Chaturdashi): the tithi is still
//        active at dawn even though the noon-sample has already rolled past
//        it, so the printed-panchangam day is the day AFTER the noon-sampled
//        thithi's own day - check yesterday's row.
// See the migration comment on panchangam_observances for the specific
// verified cases.
//
// Returns the highest-priority matching rule for the given category, or null
// if none match. Never returns a rule from a different category.
export function bestMatch(
  rowsByOffset: Record<number, PanchangamRow | undefined>,
  rules: ObservanceRule[],
  category: "tharpanam" | "observance",
): ObservanceRule | null {
  let best: ObservanceRule | null = null
  for (const rule of rules) {
    if (rule.category !== category) continue
    if (!ruleMatches(rule, rowsByOffset[rule.day_offset])) continue
    if (!best || rule.priority > best.priority) best = rule
  }
  return best
}
