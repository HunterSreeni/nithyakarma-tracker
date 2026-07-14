// Cron-invoked reminder sender. Ported from the Sandhyavandhanam app's
// send-reminders edge function, adapted to the nithyakarma schema.
// Windows (user's local time): 9:00 morning, 12:30 afternoon, 18:30 evening
// (sandhya slots, skipped if already logged), 20:00 streak nudge (any
// scheduled practice still incomplete).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_TIMEZONE = "Asia/Kolkata";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TITLES: Record<string, string> = {
  morning: "Prathakala Sandhyavandhanam 🌅",
  afternoon: "Madhyanika Sandhyavandhanam ☀️",
  evening: "Saayamkala Sandhyavandhanam 🌇",
  nudge: "Your streak is waiting 🔥",
};
const BODIES: Record<string, string> = {
  morning: "Time for your morning sandhya. Open the app!",
  afternoon: "Time for your noon sandhya. Open the app!",
  evening: "Time for your evening sandhya. Open the app!",
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

function slotFor(hour: number, minute: number): string | null {
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
    .from("notification_preferences").select("user_id, timezone").eq("enabled", true);
  const users = prefs ?? [];
  if (!users.length) return json({ message: "no users enabled" });

  const userSlot = new Map<string, string>();
  const userDate = new Map<string, string>();
  for (const u of users) {
    const lp = localParts(now, u.timezone || DEFAULT_TIMEZONE);
    if (!lp) continue;
    const slot = slotFor(lp.hour, lp.minute);
    if (slot) { userSlot.set(u.user_id, slot); userDate.set(u.user_id, lp.date); }
  }
  if (!userSlot.size) return json({ message: "no users in windows" });

  const ids = [...userSlot.keys()];
  const [{ data: subs }, { data: ups }, { data: profiles }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key, platform").in("user_id", ids),
    supabase.from("user_practices")
      .select("id, owner_id, family_member_id, practice:practices(cadence, weekday, is_sandhyavandhanam)")
      .in("owner_id", ids).is("family_member_id", null),
    supabase.from("profiles").select("id, gender").in("id", ids),
  ]);
  const genderById = new Map((profiles ?? []).map((p: any) => [p.id, p.gender]));
  const dates = [...new Set(userDate.values())];
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

  let sent = 0;
  for (const uid of ids) {
    const slot = userSlot.get(uid)!;
    const date = userDate.get(uid)!;
    const mine = (ups ?? []).filter((u: any) => u.owner_id === uid);

    if (slot === "nudge") {
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

    const title = TITLES[slot];
    const body = BODIES[slot];
    for (const sub of (subs ?? []).filter((s: any) => s.user_id === uid)) {
      const { error: dupErr } = await supabase.from("notification_deliveries")
        .insert({ user_id: uid, reminder_date: date, slot, endpoint: sub.endpoint.slice(0, 500) });
      if (dupErr) continue; // already sent this slot today to this endpoint
      const ok = sub.platform === "android"
        ? await sendFCM(supabase, config, sub.endpoint, title, body, slot)
        : await sendWebPush(supabase, config, sub, title, body);
      if (ok) sent++;
    }
  }
  return json({ message: "done", sent });
});

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
