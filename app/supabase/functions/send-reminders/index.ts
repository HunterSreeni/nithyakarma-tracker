// Cron-invoked reminder sender. Ported from the Sandhyavandhanam app's
// send-reminders edge function, adapted to the nithyakarma schema.
// Windows (user's local time): 6:00 calendar (tharpanam/observance, see
// below), 9:00 morning, 12:30 afternoon, 18:30 evening (sandhya slots,
// skipped if already logged), 8:00 and 20:00 streak nudges (any scheduled
// practice still incomplete).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";
import { bestMatch, type ObservanceRule } from "../_shared/observanceMatch.ts";

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

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

  const userSlot = new Map<string, string>();
  const userDate = new Map<string, string>();
  const userCalendarPrefs = new Map<string, { tharpanam: boolean; observances: boolean }>();
  for (const u of users) {
    const lp = localParts(now, u.timezone || DEFAULT_TIMEZONE);
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
  // panchangam_observances rules can look a day either side (day_offset: +1
  // for a night-observance like Sivarathri, attributed to the earlier
  // calendar day; -1 for a pre-dawn observance like Naraka Chaturdashi,
  // attributed to the later one) - fetch a 3-day window per distinct date.
  const panchangamDates = [...new Set(dates.flatMap((d) => [addDays(d, -1), d, addDays(d, 1)]))];

  const [{ data: subs }, { data: ups }, { data: profiles }, { data: panchangamRows }, { data: observanceRules }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key, platform").in("user_id", ids),
    supabase.from("user_practices")
      .select("id, owner_id, family_member_id, practice:practices(cadence, weekday, is_sandhyavandhanam)")
      .in("owner_id", ids).is("family_member_id", null),
    supabase.from("profiles").select("id, gender").in("id", ids),
    supabase.from("panchangam_days")
      .select("date, thithi, tamil_month, tamil_day, malayalam_month, malayalam_day, nakshatra")
      .in("date", panchangamDates),
    supabase.from("panchangam_observances").select("*"),
  ]);
  const genderById = new Map((profiles ?? []).map((p: any) => [p.id, p.gender]));
  const panchangamByDate = new Map((panchangamRows ?? []).map((r: any) => [r.date, r]));
  const rules = (observanceRules ?? []) as ObservanceRule[];
  const upIds = (ups ?? []).map((u: any) => u.id);
  const { data: logs } = upIds.length
    ? await supabase.from("practice_logs")
        .select("user_practice_id, log_date, slot").in("user_practice_id", upIds).in("log_date", dates)
    : { data: [] };

  const logsByUp = new Map<string, any[]>();
  for (const l of logs ?? []) {
    const list = logsByUp.get(l.user_practice_id) ?? [];
    list.push(l);
    logsByUp.set(l.user_practice_id, list);
  }
  const isScheduled = (p: any, dateStr: string) =>
    p.cadence !== "weekly" || new Date(dateStr + "T12:00:00Z").getUTCDay() === p.weekday;

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
      continue;
    }

    const mine = (ups ?? []).filter((u: any) => u.owner_id === uid);

    if (slot === "nudge" || slot === "nudge_morning") {
      const incomplete = mine.some((u: any) => {
        if (!isScheduled(u.practice, date)) return false;
        const dayLogs = (logsByUp.get(u.id) ?? []).filter((l: any) => l.log_date === date);
        return u.practice.is_sandhyavandhanam ? dayLogs.length < 3 : dayLogs.length === 0;
      });
      if (!incomplete || !mine.length) continue;
    } else {
      // sandhya slot reminders only for male users tracking sandhyavandhanam
      if (genderById.get(uid) !== "male") continue;
      const sandhya = mine.find((u: any) => u.practice.is_sandhyavandhanam);
      if (!sandhya) continue;
      const dayLogs = (logsByUp.get(sandhya.id) ?? []).filter((l: any) => l.log_date === date);
      if (dayLogs.some((l: any) => l.slot === slot)) continue; // already done
    }

    sent += await deliver(uid, date, slot, TITLES[slot], BODIES[slot]);
  }
  return json({ message: "done", sent });
});

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
