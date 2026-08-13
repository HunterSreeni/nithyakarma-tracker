// Pure reminder-window selection shared with tests. Calendar occasions get a
// two-hour catch-up window: delivery dedupe guarantees one successful push,
// while transient failures or one missed cron tick can retry that morning.
export function slotFor(hour: number, minute: number): string | null {
  if (hour === 6 || hour === 7) return "calendar"
  if (hour === 8) return "nudge_morning"
  if (hour === 9) return "morning"
  if (hour === 12 && minute >= 30) return "afternoon"
  if (hour === 18 && minute >= 30) return "evening"
  if (hour === 20) return "nudge"
  return null
}
