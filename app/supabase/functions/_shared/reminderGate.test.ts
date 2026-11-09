// Run with: deno test supabase/functions/_shared/reminderGate.test.ts
import { assertEquals } from "jsr:@std/assert@1"
import { shouldSendReminder, type SlotLogLike, type UserPracticeLike } from "./reminderGate.ts"

const DATE = "2026-11-09"
const LOG = (slot: string | null = null): SlotLogLike => ({ log_date: DATE, counts_toward_streak: true, slot })

const sandhya = (archived = false): UserPracticeLike => ({
  id: "sandhya", archived_at: archived ? "2026-11-01T00:00:00Z" : null,
  practice: { cadence: "daily", is_sandhyavandhanam: true, affects_streak: true },
})
const japa = (archived = false): UserPracticeLike => ({
  id: "japa", archived_at: archived ? "2026-11-01T00:00:00Z" : null,
  practice: { cadence: "daily", is_sandhyavandhanam: false, affects_streak: true },
})
const logs = (entries: Record<string, SlotLogLike[]> = {}) => new Map(Object.entries(entries))

for (const slot of ["nudge", "nudge_morning"]) {
  Deno.test(`${slot}: sent when an active practice is not yet logged`, () => {
    assertEquals(shouldSendReminder(slot, [japa()], logs(), "female", DATE), true)
  })

  Deno.test(`${slot}: silent once any one practice completed the day`, () => {
    assertEquals(shouldSendReminder(slot, [japa(), sandhya()], logs({ sandhya: [LOG("morning")] }), "male", DATE), false)
  })

  Deno.test(`${slot}: silent when every practice is removed`, () => {
    assertEquals(shouldSendReminder(slot, [japa(true)], logs(), "female", DATE), false)
  })

  Deno.test(`${slot}: a removed practice logged earlier today still completes the day`, () => {
    assertEquals(shouldSendReminder(slot, [japa(true), sandhya()], logs({ japa: [LOG()] }), "male", DATE), false)
  })

  Deno.test(`${slot}: silent with no practices at all`, () => {
    assertEquals(shouldSendReminder(slot, [], logs(), "male", DATE), false)
  })
}

Deno.test("sandhya slot: sent to a male user with an active Sandhya row and the slot open", () => {
  assertEquals(shouldSendReminder("morning", [sandhya()], logs(), "male", DATE), true)
})

Deno.test("sandhya slot: never sent to non-male users", () => {
  assertEquals(shouldSendReminder("morning", [sandhya()], logs(), "female", DATE), false)
  assertEquals(shouldSendReminder("morning", [sandhya()], logs(), undefined, DATE), false)
})

Deno.test("sandhya slot: not sent when Sandhya is archived or not tracked", () => {
  assertEquals(shouldSendReminder("evening", [sandhya(true)], logs(), "male", DATE), false)
  assertEquals(shouldSendReminder("evening", [japa()], logs(), "male", DATE), false)
})

Deno.test("sandhya slot: fires once - silent after that slot is logged, other slots still fire", () => {
  const l = logs({ sandhya: [LOG("morning")] })
  assertEquals(shouldSendReminder("morning", [sandhya()], l, "male", DATE), false)
  assertEquals(shouldSendReminder("afternoon", [sandhya()], l, "male", DATE), true)
})

Deno.test("sandhya slot: a log from another day does not count", () => {
  const l = logs({ sandhya: [{ log_date: "2026-11-08", counts_toward_streak: true, slot: "morning" }] })
  assertEquals(shouldSendReminder("morning", [sandhya()], l, "male", DATE), true)
})
