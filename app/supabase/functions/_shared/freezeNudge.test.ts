// Run with: deno test supabase/functions/_shared/freezeNudge.test.ts
import { assertEquals } from "jsr:@std/assert@1"
import { dayGap, freezeNudge } from "./freezeNudge.ts"

const TODAY = "2026-08-10"
const sub = (o: Record<string, unknown> = {}) => ({
  current_streak: 4, last_complete_date: "2026-08-09", freeze_credits: 1, ...o,
})

Deno.test("dayGap counts whole days forward", () => {
  assertEquals(dayGap("2026-08-09", TODAY), 1)
  assertEquals(dayGap("2026-08-08", TODAY), 2)
  assertEquals(dayGap(TODAY, TODAY), 0)
})

// Month and DST boundaries are the classic way a naive date subtraction slips a
// day; both sides are pinned to noon UTC precisely so they cannot.
Deno.test("dayGap crosses month boundaries", () => {
  assertEquals(dayGap("2026-07-31", "2026-08-01"), 1)
  assertEquals(dayGap("2026-02-28", "2026-03-01"), 1)
})

Deno.test("20:00 nudge: warns when today would be the first missed day", () => {
  const msg = freezeNudge("nudge", sub(), TODAY)
  assertEquals(msg?.title, "Mark today to keep your streak")
  assertEquals(msg?.body.includes("4-day streak"), true)
})

Deno.test("08:00 nudge: offers backfill before spending a freeze", () => {
  const msg = freezeNudge("nudge_morning", sub({ last_complete_date: "2026-08-08" }), TODAY)
  assertEquals(msg?.title, "Yesterday can still be backfilled")
  assertEquals(msg?.body.includes("Backfill one of yesterday's sandhyas"), true)
  assertEquals(msg?.body.includes("use a freeze"), true)
})

// The two windows must not swap: a gap-1 morning is an ordinary "not marked
// yet" day, and a gap-2 evening is past the point the morning message covered.
Deno.test("each message only fires in its own window", () => {
  assertEquals(freezeNudge("nudge_morning", sub(), TODAY), null)
  assertEquals(freezeNudge("nudge", sub({ last_complete_date: "2026-08-08" }), TODAY), null)
})

Deno.test("no freeze credit still gets the time-limited backfill warning", () => {
  assertEquals(freezeNudge("nudge", sub({ freeze_credits: 0 }), TODAY), null)
  const msg = freezeNudge("nudge_morning", sub({ last_complete_date: "2026-08-08", freeze_credits: 0 }), TODAY)
  assertEquals(msg?.title, "Yesterday can still be backfilled")
  assertEquals(msg?.body.includes("no freeze available"), true)
})

Deno.test("no live streak means no freeze message", () => {
  assertEquals(freezeNudge("nudge", sub({ current_streak: 0 }), TODAY), null)
})

// gap 3+ is unrecoverable (one freeze bridges one day), so promising a freeze
// would be a lie. decay_stale_streaks resets these to 0 anyway.
Deno.test("gap beyond a single freeze gets no freeze message", () => {
  assertEquals(freezeNudge("nudge_morning", sub({ last_complete_date: "2026-08-07" }), TODAY), null)
  assertEquals(freezeNudge("nudge", sub({ last_complete_date: "2026-08-07" }), TODAY), null)
})

Deno.test("never-completed and missing subjects fall back to the generic nudge", () => {
  assertEquals(freezeNudge("nudge", sub({ last_complete_date: null }), TODAY), null)
  assertEquals(freezeNudge("nudge", undefined, TODAY), null)
})

Deno.test("non-nudge slots are never rewritten", () => {
  assertEquals(freezeNudge("evening", sub(), TODAY), null)
})
