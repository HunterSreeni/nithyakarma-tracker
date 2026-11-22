import { assertEquals } from "jsr:@std/assert@1";
import { fcmMessage } from "./fcmMessage.ts";

Deno.test("fcmMessage keeps the Android reminders channel and adds an iOS sound", () => {
  const { message } = fcmMessage("tok", "Title", "Body", "morning");
  assertEquals(message.token, "tok");
  assertEquals(message.notification, { title: "Title", body: "Body" });
  assertEquals(message.android, { priority: "high", notification: { channel_id: "reminders", color: "#FF9933" } });
  assertEquals(message.apns, { payload: { aps: { sound: "default" } } });
  assertEquals(message.data, { url: "https://app.nithyakarma.org", slot: "morning" });
});
