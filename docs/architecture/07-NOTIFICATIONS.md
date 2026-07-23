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

`notification_preferences` holds `enabled`, `timezone` (default `Asia/Kolkata`, with the
deprecated `Asia/Calcutta` alias normalized by migration), and two sub-toggles gating
System 3 below: `tharpanam_enabled`, `observances_enabled` (both default `false`, both
inert unless `enabled` is also true). `profiles.reminder_times` holds a per-user jsonb of
slot times, but **the edge function currently uses hardcoded windows** rather than
reading it - wiring that up is part of Intent 2.4.

## System 3: tharpanam and auspicious-day ("observance") notifications

Built 23 July 2026. Rides the same `send-reminders` cron as System 1, in a new 06:00
`calendar` window - but unlike every other slot, `calendar` is an **internal marker**,
not a `notification_deliveries` slot value. It can fan out to zero, one, or two actual
deliveries per user (tharpanam and observance are independent categories, each gated by
its own toggle), which doesn't fit the one-slot-per-user shape the rest of `slotFor()`
uses. The two real slot values it can produce are `tharpanam` and `observance`.

**Data-driven, not per-date rows.** `panchangam_observances` is a small static rule
table (16 rows as of 23 July 2026), not an events calendar - every occasion reduces to a
pattern against a `panchangam_days` row (`thithi`/`tamil_month`/`tamil_day`/
`malayalam_month`/`malayalam_day`/`nakshatra`), so unlike `panchangam_days` itself this
table never needs annual regeneration. Matching is a pure function,
`_shared/observanceMatch.ts`'s `bestMatch()`, unit tested independent of the Deno
handler (see "Deno testing in CI" below).

`day_offset` lets a rule match against a **neighboring day's** row instead of its own
candidate day, and can point either direction - this is the solar-noon-sampling
limitation from [08-PANCHANGAM.md](08-PANCHANGAM.md#known-limitations) showing up in
practice, not a new gap:

- **+1 (check tomorrow):** a night observance, where the tithi begins in the evening -
  the printed-panchangam day is the day *before* the noon-sampled thithi's own day.
  Maha Sivarathri and Vijayadashami both need this (each verified: our noon-sampled
  Chaturdashi/Dashami row lands one day after the cited source's actual observance day).
- **-1 (check yesterday):** a pre-dawn observance, where the tithi is still active at
  dawn even though the noon-sample has already rolled past it - the printed-panchangam
  day is the day *after* the noon-sampled thithi's own day. Naraka Chaturdashi needs
  this (verified: our noon-sampled Krishna Chaturdashi row lands one day before the
  cited source's 8 Nov 2026 observance day).

**Festival set, verified against loaded `panchangam_days` (2026-2027) and cited sources,
23 July 2026:** Pongal, Tamil New Year, Vishu, Onam (Chingam + Shravana nakshatra, same
pattern as Karthigai Deepam below), the two Sankranti tharpanams, monthly Amavasya,
Karkidaka Vaavu, Maha Sivarathri, Krishna Janmashtami, Vinayaka Chaturthi,
Vijayadashami, Naraka Chaturdashi (Deepavali), Karthigai Deepam (Karthikai month +
Krittika nakshatra, not thithi), Skanda Sashti. Not seeded, no reliable rule found yet:
the exact main-Diwali Lakshmi Puja day (distinct from Naraka Chaturdashi) needs
sub-day precision the current noon-sampling can't give - two consecutive days can both
show `thithi = 'Amavasya'` when that tithi happens to span both noons, and picking the
"correct" one of the two needs finer timing data than `panchangam_days` stores. Extend
`panchangam_observances` with new rows (no code change needed) for anything else wanted
later, verified the same way: check a cited external date against the loaded data,
and if they disagree by exactly one day, suspect a night/dawn boundary rather than an
error and check the neighboring day before assuming `day_offset` is needed.

## Deno testing in CI

`_shared/observanceMatch.test.ts` is the first Deno-side test this project has -
`supabase/functions/**` was entirely untested in CI before it, since it runs on Deno,
not Node/Vite, and vitest can't parse `Deno.test`/`jsr:` imports (it's excluded from
vitest's discovery in `vite.config.js` for that reason). A dedicated `edge-functions`
job in `.github/workflows/ci.yml` (`denoland/setup-deno@v2`, `deno test`) now runs it on
every push/PR - added and verified (`deno test` run locally, all cases passing) 23 July
2026, same session as the festival set above.

## Extension point history

The section above replaces an earlier one-line sketch ("a new `observance` slot in
`slotFor()`, dedupe through `notification_deliveries`, a `notification_preferences`
toggle") that undersold the actual shape needed - the fan-out-to-two-categories nuance
wasn't visible until building it. Kept as a reminder that a sketch is not a spec.

## Related

- Server detail: [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md)
- Panchangam data pipeline: [08-PANCHANGAM.md](08-PANCHANGAM.md)
- Tables: [01-DATABASE.md](01-DATABASE.md)
