import { assertEquals } from "jsr:@std/assert@1"
import { slotFor } from "./reminderWindow.ts"

Deno.test("calendar reminders can catch up throughout 06:00 and 07:00", () => {
  assertEquals(slotFor(6, 0), "calendar")
  assertEquals(slotFor(6, 45), "calendar")
  assertEquals(slotFor(7, 0), "calendar")
  assertEquals(slotFor(7, 59), "calendar")
})

Deno.test("calendar window stops before the morning streak nudge", () => {
  assertEquals(slotFor(5, 59), null)
  assertEquals(slotFor(8, 0), "nudge_morning")
})
