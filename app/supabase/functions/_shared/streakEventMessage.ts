export type StreakEvent = {
  event_type: "freeze_used" | "streak_reset"
  streak_before: number
  streak_after: number
  freeze_before: number
  freeze_after: number
}

export function streakEventMessage(event: StreakEvent, familyName?: string) {
  const subject = familyName ? `${familyName}'s` : "Your"
  if (event.event_type === "freeze_used") {
    const remaining = event.freeze_after
    return {
      title: "A streak freeze was used",
      body: `${subject} ${event.streak_after}-day streak is safe. One freeze was used; ${remaining} ${remaining === 1 ? "remains" : "remain"}.`,
    }
  }
  return {
    title: "Streak reset to 0",
    body: `${subject} ${event.streak_before}-day streak ended after the catch-up window passed. Start again with today's anushtanam.`,
  }
}
