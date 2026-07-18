# 03 - Edge Functions and Scheduling

Deno-based Supabase Edge Functions in `app/supabase/functions/`.

| Function | Lines | Invoked by | Purpose |
|---|---|---|---|
| `send-reminders` | 140 | pg_cron, every 15 min | All scheduled push notifications |
| `send-test-notification` | 67 | Client button | Verify a device's push setup |
| `_shared/push.ts` | 116 | Both | Config loading, FCM and Web Push transports |

---

## Scheduling

One pg_cron job:

```
jobid 1 | send-reminders-every-15min | */15 * * * * | active
```

It POSTs to `https://fkrifejzhnhknkuyhjhp.supabase.co/functions/v1/send-reminders`
with an `Authorization: Bearer <cron_secret>` header, reading `cron_secret` from
`app_config`.

The 15-minute cadence means the function must be **idempotent** - it can run up to 4
times inside any notification window. `notification_deliveries` provides that
idempotency (see below).

---

## send-reminders

### Windows

Evaluated in **each user's own timezone**, from `notification_preferences.timezone`
(default `Asia/Kolkata`), via `Intl.DateTimeFormat` with `en-CA` for ISO date output.

| Local time | Slot | Audience |
|---|---|---|
| 08:00 | `nudge_morning` | Anyone with an incomplete day |
| 09:00 | `morning` | Male users tracking Sandhyavandhanam |
| 12:30 | `afternoon` | Male users tracking Sandhyavandhanam |
| 18:30 | `evening` | Male users tracking Sandhyavandhanam |
| 20:00 | `nudge` | Anyone with an incomplete day |

### The smart-suppression logic

This is the part that makes reminders feel considerate rather than nagging
(`index.ts:106-120`):

**For nudge slots** - compute `incomplete` across every *scheduled* practice for the
user. Sandhyavandhanam counts as incomplete until all 3 slots are logged; everything
else until 1 log exists. If nothing is incomplete, or the user tracks nothing at all,
**skip entirely**.

**For sandhya slots** - skip unless the user is male and actually tracks
Sandhyavandhanam; then skip if a log already exists for *that specific slot* today. So
someone who did their morning sandhya early never gets the 09:00 reminder.

### Idempotency

Before sending, insert into `notification_deliveries (user_id, reminder_date, slot,
endpoint)`. The UNIQUE index makes a repeat insert fail with Postgres code `23505`, and
**only that code** is treated as "already sent". Any other insert error is logged and
the send is skipped, so a fault cannot masquerade as a duplicate.

> ### Fixed 2026-07-18
>
> The original code was `if (dupErr) continue;` - treating **any** insert error as a
> duplicate. Because the `slot` CHECK constraint omitted `nudge_morning`, every 08:00
> insert failed the constraint, was misread as a duplicate, and the notification was
> silently dropped. Zero `nudge_morning` rows had ever been written while the four
> permitted slots each had 13-17. **The 08:00 morning nudge had never fired for anyone.**
>
> Closed by migration `20260718170117_notification_deliveries_nudge_morning_slot` plus
> the narrowed error handling described above.

### Transports

Dispatched per subscription row by `platform`:
- `android` → `sendFCM()` - Firebase Cloud Messaging, `endpoint` holds the FCM token
- `web` → `sendWebPush()` - VAPID-signed Web Push, using `p256dh` + `auth_key`

---

## send-test-notification

Client-invoked from `NotificationSettings`, sends a single push to all of the calling
user's subscriptions. Used to verify a device is correctly registered.

> On Android this only *looks* like it did nothing if the app is in the foreground -
> Android hands foreground data messages to the app rather than the system tray. The
> `pushNotificationReceived` listener in `utils/pushAndroid.js:50` raises a local
> notification to cover that case (this was bug B6, now fixed).

---

## _shared/push.ts

| Export | Purpose |
|---|---|
| `loadConfig()` | Reads VAPID keys and email from `app_config` |
| `sendFCM()` | FCM HTTP v1 send |
| `sendWebPush()` | VAPID-signed Web Push send |

---

## Secrets

**Names only. Never commit values.**

| Secret | Location | Used by |
|---|---|---|
| `cron_secret` | `app_config` row | pg_cron authenticates to the function |
| `vapid_private_key` | `app_config` row | Web Push signing |
| `vapid_public_key` | `app_config` row | Web Push signing |
| `vapid_email` | `app_config` row | VAPID contact |
| `SUPABASE_URL` | Edge function env | Both functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function env | Both functions |
| `VITE_VAPID_PUBLIC_KEY` | Netlify build env | Client subscribe |
| Firebase admin key | `~/.secrets/` (outside repo) | FCM |

### History worth knowing

- **July 2026:** VAPID private key and cron secret were committed in plaintext inside a
  migration (finding S1). Both have been rotated. The migration file is still in git
  history.
- **July 2026:** a production push outage was caused by `service_role` lacking explicit
  table GRANTs. New `sb_secret_` keys do **not** bypass grants the way older service keys
  did. Fixed by `20260711122657_service_role_read_grants`.
- **July 2026:** prod-only subscribe failure traced to a truncated
  `VITE_VAPID_PUBLIC_KEY` in Netlify env (missing leading character).

> Storing secrets as table rows remains a compromise. Edge function env vars or Supabase
> Vault is the correct destination.

## Related

- Client-side push: [07-NOTIFICATIONS.md](07-NOTIFICATIONS.md)
- `notification_deliveries` schema: [01-DATABASE.md](01-DATABASE.md)
