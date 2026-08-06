// Run with: deno test supabase/functions/_shared/dayComplete.test.ts
import { assertEquals } from "jsr:@std/assert@1"
import { dayComplete, isScheduled } from "./dayComplete.ts"

const DATE = "2026-08-06" // a Thursday

const item = (overrides: Record<string, unknown>, logs: { log_date: string; counts_toward_streak?: boolean }[]) => ({
  practice: { is_sandhyavandhanam: false, cadence: "daily", affects_streak: true, ...overrides },
  logs,
})

Deno.test("isScheduled: daily practice is always scheduled", () => {
  assertEquals(isScheduled({ cadence: "daily" }, DATE), true)
})

Deno.test("isScheduled: weekly practice only on its weekday", () => {
  assertEquals(isScheduled({ cadence: "weekly", weekday: 4 }, DATE), true) // Thursday = 4
  assertEquals(isScheduled({ cadence: "weekly", weekday: 5 }, DATE), false)
})

Deno.test("dayComplete: false when nothing is logged", () => {
  const items = [item({}, []), item({}, [])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: true as soon as any one gating practice is logged", () => {
  const items = [
    item({}, []),
    item({}, [{ log_date: DATE, counts_toward_streak: true }]),
  ]
  assertEquals(dayComplete(items, DATE), true)
})

// The exact bug reported 2026-08-06: user marks a non-sandhya practice, the
// streak counts (any one gating practice is enough), but sandhyavandhanam
// itself is still unmarked. The nudge must NOT fire.
Deno.test("dayComplete: streak-affecting practice done elsewhere silences the nudge even if sandhya is untouched", () => {
  const items = [
    item({ is_sandhyavandhanam: true }, []), // sandhya: no slots logged
    item({}, [{ log_date: DATE, counts_toward_streak: true }]), // another practice: done
  ]
  assertEquals(dayComplete(items, DATE), true)
})

Deno.test("dayComplete: any 1 of the 3 sandhya slots is enough, not all 3", () => {
  const items = [item({ is_sandhyavandhanam: true }, [{ log_date: DATE, counts_toward_streak: true }])]
  assertEquals(dayComplete(items, DATE), true)
})

Deno.test("dayComplete: sandhya with zero slots logged does not complete the day on its own", () => {
  const items = [item({ is_sandhyavandhanam: true }, [])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: a non-affects_streak (Learning-style) log cannot complete the day alone", () => {
  const items = [item({ affects_streak: false }, [{ log_date: DATE, counts_toward_streak: true }])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: a counts_toward_streak=false log does not complete the day", () => {
  const items = [item({}, [{ log_date: DATE, counts_toward_streak: false }])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: an absent counts_toward_streak counts, matching the DB column default", () => {
  const items = [item({}, [{ log_date: DATE }])]
  assertEquals(dayComplete(items, DATE), true)
})

Deno.test("dayComplete: a weekly practice not scheduled today does not count, even if logged (stale log)", () => {
  const items = [item({ cadence: "weekly", weekday: (new Date(DATE + "T12:00:00Z").getUTCDay() + 1) % 7 },
    [{ log_date: DATE, counts_toward_streak: true }])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: only today's logs count, not a stale prior-day log", () => {
  const items = [item({}, [{ log_date: "2026-08-05", counts_toward_streak: true }])]
  assertEquals(dayComplete(items, DATE), false)
})

Deno.test("dayComplete: empty item list is not complete", () => {
  assertEquals(dayComplete([], DATE), false)
})
