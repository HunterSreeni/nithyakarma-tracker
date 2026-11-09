// AI-DEV NOTE: Protected reminder gating, extracted verbatim from
// send-reminders/index.ts so it can be unit-tested. See AGENTS.md
// "Notifications & reminders" - do not change without Sreeni's explicit
// instruction.
//
// - Streak nudges ("nudge" 20:00, "nudge_morning" 08:00): skip a user whose
//   practices are ALL removed (archived) - nothing to nudge about - and skip
//   once the day is already complete. Day completion counts EVERY row's logs,
//   archived included, exactly like submit_practice_log's aggregate: a practice
//   logged earlier today and removed afterwards still secured the day.
// - Sandhya slot reminders: male users with an ACTIVE Sandhyavandhanam row
//   only, and each slot fires once - never after that slot is logged today.

import { dayComplete, type LogLike, type PracticeLike } from "./dayComplete.ts"

export interface UserPracticeLike {
  id: string
  archived_at?: string | null
  practice: PracticeLike
}

export interface SlotLogLike extends LogLike {
  slot?: string | null
}

export function shouldSendReminder(
  slot: string,
  mine: UserPracticeLike[],
  logsByUp: Map<string, SlotLogLike[]>,
  gender: string | null | undefined,
  date: string,
): boolean {
  const active = mine.filter((u) => !u.archived_at)

  if (slot === "nudge" || slot === "nudge_morning") {
    if (!active.length) return false
    const items = mine.map((u) => ({ practice: u.practice, logs: logsByUp.get(u.id) ?? [] }))
    return !dayComplete(items, date)
  }

  if (gender !== "male") return false
  const sandhya = active.find((u) => u.practice.is_sandhyavandhanam)
  if (!sandhya) return false
  const dayLogs = (logsByUp.get(sandhya.id) ?? []).filter((l) => l.log_date === date)
  return !dayLogs.some((l) => l.slot === slot)
}
