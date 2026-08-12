// Picks the freeze-aware wording for the 08:00 / 20:00 streak nudges.
//
// Freezes are consumed by submit_practice_log -> streak_after_completion when
// the user comes back and completes a day across a 1-day gap. Nothing is spent
// at the moment a day is missed (see migration 20260810050000, which reverted
// the proactive spend). That leaves two moments worth naming explicitly, and
// both have to be judged in the user's LOCAL day - which is why they live here
// in send-reminders (per-user timezone, every 15 min) rather than in a
// fixed-UTC daily cron:
//
//   20:00, last completed yesterday  -> today is about to become the missed day
//   08:00, last completed 2 days ago -> a freeze is the only thing still
//                                       holding the streak, and it only pays
//                                       out if they mark TODAY
//
// Returns null whenever the generic nudge in send-reminders is the right
// message, so the caller keeps TITLES/BODIES as its default.

export interface StreakSubject {
  current_streak?: number | null;
  last_complete_date?: string | null;
  freeze_credits?: number | null;
}

export interface NudgeMessage {
  title: string;
  body: string;
}

// Whole days from `from` to `to`, both 'YYYY-MM-DD'. Noon UTC on both sides so
// no DST or timezone offset can push the difference across a day boundary.
export function dayGap(from: string, to: string): number {
  const a = Date.parse(from + "T12:00:00Z");
  const b = Date.parse(to + "T12:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

export function freezeNudge(
  slot: string,
  subject: StreakSubject | undefined,
  localDate: string,
): NudgeMessage | null {
  if (!subject) return null;
  const streak = subject.current_streak ?? 0;
  const credits = subject.freeze_credits ?? 0;
  const last = subject.last_complete_date;
  if (streak <= 0 || !last) return null;

  const gap = dayGap(last, localDate);
  if (!Number.isFinite(gap)) return null;

  if (slot === "nudge" && gap === 1 && credits > 0) {
    return {
      title: "Mark today to keep your streak",
      body:
        `Namaskaram! Nothing marked yet today. Mark one anushtanam now, or your ` +
        `${streak}-day streak will need a freeze to survive.`,
    };
  }

  if (slot === "nudge_morning" && gap === 2) {
    const alternative = credits > 0
      ? " You can instead mark one anushtanam today to use a freeze."
      : " You have no freeze available, so complete the backfill before today ends."
    return {
      title: "Yesterday can still be backfilled",
      body:
        `Namaskaram! You missed yesterday. Backfill one of yesterday's sandhyas to ` +
        `keep your ${streak}-day streak without spending a freeze.${alternative}`,
    };
  }

  return null;
}
