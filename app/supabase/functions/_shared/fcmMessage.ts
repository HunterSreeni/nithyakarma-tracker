// AI-DEV NOTE: Protected push payload. See AGENTS.md "Notifications &
// reminders". Kept apart from push.ts so tests need not load web-push.

export const APP_URL = "https://app.nithyakarma.org";

// AI-DEV NOTE: one message for Android and iOS tokens. FCM uses only the block
// for the token's platform: `android` (the "reminders" channel must exist on the
// device, see utils/pushAndroid.js) or `apns`, where the default sound is what
// makes an iPhone reminder audible.
export function fcmMessage(token: string, title: string, body: string, slot: string) {
  return {
    message: {
      token,
      notification: { title, body },
      android: { priority: "high", notification: { channel_id: "reminders", color: "#FF9933" } },
      apns: { payload: { aps: { sound: "default" } } },
      data: { url: APP_URL, slot },
    },
  };
}
