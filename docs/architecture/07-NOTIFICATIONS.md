# 07 - Notification Architecture

There are **two independent notification systems** running side by side. Understanding
which is which is essential before changing either.

| | Server push | Local notifications |
|---|---|---|
| Origin | `send-reminders` edge function | On-device OS alarms |
| Trigger | pg_cron every 15 min | `every: 'day'` OS recurrence |
| Knows app state? | **Yes** - queries `practice_logs` | **No** - fires blindly |
| Platforms | Web + Android | Android only (no-op on web) |
| Suppression | Skips before sending | Cancel-and-reschedule after the fact |
| Code | `supabase/functions/send-reminders/` | `src/utils/notifications.js` |

---

## System 1: server push

Fully covered in [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md). The summary:

The cron job hits `send-reminders` every 15 minutes. For each user with push enabled, it
computes their local time from `notification_preferences.timezone`, maps it to a slot,
and **queries `practice_logs` before sending**. Nudges are skipped when the day is
already complete; sandhya slot reminders are skipped when that slot is already logged.
`notification_deliveries` provides idempotency.

This is the genuinely "smart" half. It never nags someone who has already finished.

> The 08:00 `nudge_morning` slot had **never fired** since launch, due to a CHECK
> constraint mismatch swallowed by over-broad error handling. Fixed 2026-07-18 - see
> [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md) and
> [01-DATABASE.md](01-DATABASE.md#notification_deliveries).

### Transports

| Platform | Mechanism | Registration |
|---|---|---|
| Android | FCM | `utils/pushAndroid.js` `registerFCM()` stores the token |
| Web | Web Push + VAPID | `utils/webPush.js` `setupWebPush()` stores endpoint + keys |

Both land in `push_subscriptions`, distinguished by `platform`, and `send-reminders`
dispatches per row.

### Android foreground handling

Android delivers foreground data messages to the app rather than the system tray, so
without a listener they vanish. `utils/pushAndroid.js` registers four listeners:

| Listener | Purpose |
|---|---|
| `registration` | Save the FCM token |
| `registrationError` | Surface failure |
| `pushNotificationActionPerformed` | Handle a tap |
| `pushNotificationReceived` | **Raise a local notification** so foreground pushes are visible |

The fourth was missing originally (bug B6) - test notifications appeared to do nothing
while the app was open. Now fixed.

---

## System 2: local notifications

`src/utils/notifications.js`. Native-only; silently no-ops on web.

| ID | Time | Notification | Scheduled when |
|---|---|---|---|
| 100 | 09:00 | Prathakala Sandhyavandhanam | `includeSandhya` |
| 200 | 12:30 | Madhyanika Sandhyavandhanam | `includeSandhya` |
| 300 | 18:30 | Saayamkala Sandhyavandhanam | `includeSandhya` |
| 400 | 20:00 | "Your streak is waiting" | Always |
| 500 | 21:30 | "Last call before midnight" | Always |

Fixed IDs are what make targeted cancellation possible.

### The suppression problem and its solution

Local notifications are a blind OS-level `every: 'day'` recurrence. The OS has no idea
whether the user has marked anything. Cancelling removes the **entire future
recurrence**, not just today's firing - so naive cancellation would permanently disable
the reminder.

`suppressTodayNudgesIfScheduled()` handles this:

1. Read pending notifications. **If neither 400 nor 500 is pending, return immediately.**
   This guard is important - it means the function can never *start* scheduling
   notifications for a user who never opted in
2. Cancel 400 and 500
3. Reschedule both for **tomorrow** at the same times, still `every: 'day'`

The daily recurrence then resumes naturally, because a fresh day legitimately starts
with nothing marked.

**Sandhya slots (100/200/300) are deliberately left alone.** Those mark specific ritual
times of day, not streak-at-risk warnings. Silencing them because the streak is safe
would defeat their purpose.

### Where it is called

Exactly one place: `hooks/useToday.js` `submit()`, gated on `data.day_complete` from the
verified RPC response. Centralizing it there means `TodayPage` and `LearningPage` both
inherit the behaviour without duplicating it.

```js
if (data.day_complete) suppressTodayNudgesIfScheduled().catch(() => {})
```

The `.catch(() => {})` is intentional - a suppression failure must never break the save
that just succeeded.

---

## Overlap worth knowing

An Android user with both systems enabled has two paths to a 20:00 nudge: the server's
`nudge` slot and local ID 400. They suppress differently - the server checks before
sending, the client cancels after completing. In practice the server slot is skipped when
the day is complete, and the local one is rescheduled to tomorrow, so a completed day
produces neither. An **incomplete** day can produce both.

Consolidating onto server push alone would be simpler and is worth considering in the
Intent 2.4 reminder overhaul.

## Preferences and identity

`notification_preferences` holds `enabled` and `timezone` (default `Asia/Kolkata`, with
the deprecated `Asia/Calcutta` alias normalized by migration). `profiles.reminder_times`
holds a per-user jsonb of slot times, but **the edge function currently uses hardcoded
windows** rather than reading it - wiring that up is part of Intent 2.4.

## Extension point: auspicious-day notifications

The planned observance push should reuse this machinery rather than add a parallel one:
a new `observance` slot in `slotFor()`, dedupe through the same
`notification_deliveries` insert, and a `notification_preferences.observances_enabled`
toggle. **Adding `observance` to the `slot` CHECK is required** - forgetting it is
exactly the mistake that hid the `nudge_morning` slot for months.

## Related

- Server detail: [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md)
- Tables: [01-DATABASE.md](01-DATABASE.md)
