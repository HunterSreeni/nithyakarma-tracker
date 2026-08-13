import { assertEquals } from "jsr:@std/assert@1";
import { streakEventMessage } from "./streakEventMessage.ts";

Deno.test("freeze-used push reports the resulting streak and exact remaining balance", () => {
  assertEquals(streakEventMessage({
    event_type: "freeze_used", streak_before: 4, streak_after: 5,
    freeze_before: 2, freeze_after: 1,
  }), {
    title: "A streak freeze was used",
    body: "Your 5-day streak is safe. One freeze was used; 1 remains.",
  });
});

Deno.test("freeze-used push names a child and pluralizes zero remaining", () => {
  assertEquals(streakEventMessage({
    event_type: "freeze_used", streak_before: 8, streak_after: 9,
    freeze_before: 1, freeze_after: 0,
  }, "Ravi"), {
    title: "A streak freeze was used",
    body: "Ravi's 9-day streak is safe. One freeze was used; 0 remain.",
  });
});

Deno.test("reset push reports the transition to zero", () => {
  assertEquals(streakEventMessage({
    event_type: "streak_reset", streak_before: 12, streak_after: 0,
    freeze_before: 0, freeze_after: 0,
  }), {
    title: "Streak reset to 0",
    body: "Your 12-day streak ended after the catch-up window passed. Start again with today's anushtanam.",
  });
});
