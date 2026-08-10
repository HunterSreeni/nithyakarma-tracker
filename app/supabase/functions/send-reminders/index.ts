// Cron-invoked reminder sender. Ported from the Sandhyavandhanam app's
// send-reminders edge function, adapted to the nithyakarma schema.
// Windows (user's local time): 6:00 calendar (tharpanam/observance, see
// below), 9:00 morning, 12:30 afternoon, 18:30 evening (sandhya slots,
// skipped if already logged), 8:00 and 20:00 streak nudges (any scheduled
// practice still incomplete). The two nudges switch to freeze-specific wording
// when a freeze is what's holding the streak up - see _shared/freezeNudge.ts.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";
import { addDays, bestAdvanceMatch, bestMatch, type ObservanceRule } from "../_shared/observanceMatch.ts";
import { dayComplete } from "../_shared/dayComplete.ts";
import { freezeNudge } from "../_shared/freezeNudge.ts";

const ADVANCE_DAYS = 3;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_TIMEZONE = "Asia/Kolkata";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TITLES: Record<string, string> = {
  morning: "Prathakala Sandhyavandhanam",
  afternoon: "Madhyanika Sandhyavandhanam",
  evening: "Saayamkala Sandhyavandhanam",
  nudge_morning: "Start your streak today",
  nudge: "Your streak is waiting",
};
const BODIES: Record<string, string> = {
  morning: "Time for your morning sandhya. Open the app!",
  afternoon: "Time for your noon sandhya. Open the app!",
  evening: "Time for your evening sandhya. Open the app!",
  nudge_morning: "Namaskaram! Today's anushtanams are waiting. 2 minutes is all it takes.",
  nudge: "Namaskaram! Today's anushtanams are not all marked yet. 2 minutes is all it takes.",
};

function localParts(now: Date, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "numeric", minute: "numeric", hour12: false, timeZone: tz,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: parseInt(get("hour")), minute: parseInt(get("minute")),
    };
  } catch { return null; }
}

// 'calendar' is an internal marker, not a final notification_deliveries slot -
// it can fan out to zero, one, or two deliveries per user (tharpanam and
// observance are independent, each gated by its own preference toggle), which
// doesn't fit the one-slot-per-user shape the other windows use.
function slotFor(hour: number, minute: number): string | null {
  if (hour === 6) return "calendar";
  if (hour === 8) return "nudge_morning";
  if (hour === 9) return "morning";
  if (hour === 12 && minute >= 30) return "afternoon";
  if (hour === 18 && minute >= 30) return "evening";
  if (hour === 20) return "nudge";
  return null;
}

Deno.serve(async (req: Request) => {
  const config = await loadConfig(supabase);
  const authHeader = req.headers.get("Authorization");
  if (!config.cron_secret || authHeader !== `Bearer ${config.cron_secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, timezone, tharpanam_enabled, observances_enabled").eq("enabled", true);
  const users = prefs ?? [];
  if (!users.length) return json({ message: "no users enabled" });

  // profiles.timezone is the single source of truth for a user's local day
  // (migration 20260810120000) - the same column decay_stale_streaks reads, so
  // reminder windows and streak boundaries cannot disagree. It is written on
  // every profile load, whereas notification_preferences.timezone is only
  // written when the notification toggle is used; that one stays as a fallback
  // for rows predating the column. Fetched before the slot loop because the
  // timezone decides which users are in a window at all.
  const prefUserIds = users.map((u: any) => u.user_id);
  const { data: profiles } = await supabase.from("profiles")
    .select("id, gender, timezone, current_streak, last_complete_date, freeze_credits")
    .in("id", prefUserIds);
  const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const userSlot = new Map<string, string>();
  const userDate = new Map<string, string>();
  const userCalendarPrefs = new Map<string, { tharpanam: boolean; observances: boolean }>();
  for (const u of users) {
    const lp = localParts(now, profileById.get(u.user_id)?.timezone || u.timezone || DEFAULT_TIMEZONE);
    if (!lp) continue;
    const slot = slotFor(lp.hour, lp.minute);
    if (slot) {
      userSlot.set(u.user_id, slot);
      userDate.set(u.user_id, lp.date);
      userCalendarPrefs.set(u.user_id, { tharpanam: !!u.tharpanam_enabled, observances: !!u.observances_enabled });
    }
  }
  if (!userSlot.size) return json({ message: "no users in windows" });

  const ids = [...userSlot.keys()];
  const dates = [...new Set(userDate.values())];
  // Also resolve each date's advance target (today + ADVANCE_DAYS) so the
  // "in N days" push can run the same rule engine against that future date.
  const advanceDates = [...new Set(dates.map((d) => addDays(d, ADVANCE_DAYS)))];
  // panchangam_observances rules can look a day either side (day_offset: +1
  // for a night-observance like Sivarathri, attributed to the earlier
  // calendar day; -1 for a pre-dawn observance like Naraka Chaturdashi,
  // attributed to the later one) - fetch a 1-day window either side of every
  // date we'll match rules against, today's and the advance target's alike.
  const panchangamDates = [...new Set(
    [...dates, ...advanceDates].flatMap((d) => [addDays(d, -1), d, addDays(d, 1)]),
  )];

  const [{ data: subs }, { data: ups }, { data: panchangamRows }, { data: observanceRules }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key, platform").in("user_id", ids),
    supabase.from("user_practices")
      .select("id, owner_id, family_member_id, practice:practices(cadence, weekday, is_sandhyavandhanam, affects_streak)")
      .in("owner_id", ids).is("family_member_id", null),
    supabase.from("panchangam_days")
      .select("date, thithi, tamil_month, tamil_day, malayalam_month, malayalam_day, nakshatra")
      .in("date", panchangamDates),
    supabase.from("panchangam_observances").select("*"),
  ]);
  const panchangamByDate = new Map((panchangamRows ?? []).map((r: any) => [r.date, r]));
  const rules = (observanceRules ?? []) as ObservanceRule[];
  const upIds = (ups ?? []).map((u: any) => u.id);
  const { data: logs } = upIds.length
    ? await supabase.from("practice_logs")
        .select("user_practice_id, log_date, slot, counts_toward_streak").in("user_practice_id", upIds).in("log_date", dates)
    : { data: [] };

  const logsByUp = new Map<string, any[]>();
  for (const l of logs ?? []) {
    const list = logsByUp.get(l.user_practice_id) ?? [];
    list.push(l);
    logsByUp.set(l.user_practice_id, list);
  }

  async function deliver(uid: string, date: string, slot: string, title: string, body: string) {
    let count = 0;
    for (const sub of (subs ?? []).filter((s: any) => s.user_id === uid)) {
      const { error: insErr } = await supabase.from("notification_deliveries")
        .insert({ user_id: uid, reminder_date: date, slot, endpoint: sub.endpoint.slice(0, 500) });
      if (insErr) {
        // 23505 = unique violation: genuinely already sent this slot today to this
        // endpoint, so skipping is correct. Anything else is a real fault (e.g. a
        // slot name the CHECK constraint rejects) and must be loud - treating every
        // insert error as "already sent" is what silently swallowed the
        // 'nudge_morning' slot for months.
        if (insErr.code === "23505") continue;
        console.error("delivery insert failed", { slot, code: insErr.code, message: insErr.message });
        continue;
      }
      const ok = sub.platform === "android"
        ? await sendFCM(supabase, config, sub.endpoint, title, body, slot)
        : await sendWebPush(supabase, config, sub, title, body);
      if (ok) count++;
    }
    return count;
  }

  let sent = 0;
  for (const uid of ids) {
    const slot = userSlot.get(uid)!;
    const date = userDate.get(uid)!;

    if (slot === "calendar") {
      const rowsByOffset = {
        [-1]: panchangamByDate.get(addDays(date, -1)),
        0: panchangamByDate.get(date),
        1: panchangamByDate.get(addDays(date, 1)),
      };
      const calendarPrefs = userCalendarPrefs.get(uid)!;
      if (calendarPrefs.tharpanam) {
        const rule = bestMatch(rowsByOffset as any, rules, "tharpanam");
        if (rule) sent += await deliver(uid, date, "tharpanam", rule.title, rule.message);
      }
      if (calendarPrefs.observances) {
        const rule = bestMatch(rowsByOffset as any, rules, "observance");
        if (rule) sent += await deliver(uid, date, "observance", rule.title, rule.message);
      }

      // "In N days" heads-up for the same two categories, gated by the same
      // preference each already uses - a rule only fires here if it's also
      // marked advance_notify (see migration 20260802153000).
      const advanceDate = addDays(date, ADVANCE_DAYS);
      const advanceRowsByOffset = {
        [-1]: panchangamByDate.get(addDays(advanceDate, -1)),
        0: panchangamByDate.get(advanceDate),
        1: panchangamByDate.get(addDays(advanceDate, 1)),
      };
      if (calendarPrefs.tharpanam) {
        const rule = bestAdvanceMatch(advanceRowsByOffset as any, rules, "tharpanam");
        if (rule) {
          sent += await deliver(uid, advanceDate, "observance_advance", `In ${ADVANCE_DAYS} days: ${rule.title}`, rule.message);
        }
      }
      if (calendarPrefs.observances) {
        const rule = bestAdvanceMatch(advanceRowsByOffset as any, rules, "observance");
        if (rule) {
          sent += await deliver(uid, advanceDate, "observance_advance", `In ${ADVANCE_DAYS} days: ${rule.title}`, rule.message);
        }
      }
      continue;
    }

    const mine = (ups ?? []).filter((u: any) => u.owner_id === uid);
    let title = TITLES[slot];
    let body = BODIES[slot];

    if (slot === "nudge" || slot === "nudge_morning") {
      // Mirrors cadence.js's dayComplete / the SQL bool_or day-completion
      // aggregate: ANY ONE affects_streak, scheduled practice logged today
      // (any 1 of 3 sandhya slots included) already secures the streak, so
      // the nudge must stay silent - not require every practice logged.
      if (!mine.length) continue;
      const items = mine.map((u: any) => ({ practice: u.practice, logs: logsByUp.get(u.id) ?? [] }));
      if (dayComplete(items, date)) continue;
      // Say what is actually at stake when a freeze is in play, instead of the
      // generic "your streak is waiting". Both windows are judged against the
      // user's own local date, which is what makes this the right place for it.
      const freezeMsg = freezeNudge(slot, profileById.get(uid), date);
      if (freezeMsg) { title = freezeMsg.title; body = freezeMsg.body; }
    } else {
      // sandhya slot reminders only for male users tracking sandhyavandhanam
      if (profileById.get(uid)?.gender !== "male") continue;
      const sandhya = mine.find((u: any) => u.practice.is_sandhyavandhanam);
      if (!sandhya) continue;
      const dayLogs = (logsByUp.get(sandhya.id) ?? []).filter((l: any) => l.log_date === date);
      if (dayLogs.some((l: any) => l.slot === slot)) continue; // already done
    }

    sent += await deliver(uid, date, slot, title, body);
  }
  return json({ message: "done", sent });
});

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
