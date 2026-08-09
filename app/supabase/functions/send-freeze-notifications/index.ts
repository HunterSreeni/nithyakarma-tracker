// Cron-invoked, runs a few minutes after decay-stale-streaks-daily
// (see migration 20260809070000). decay_stale_streaks() logs a freeze_events
// row whenever it auto-spends a freeze credit to protect a streak; this
// function turns those rows into a push so the user actually sees it
// happened, instead of just noticing the streak/freeze count unchanged.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  const config = await loadConfig(supabase);
  const authHeader = req.headers.get("Authorization");
  if (!config.cron_secret || authHeader !== `Bearer ${config.cron_secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // A 1h window comfortably covers "the freeze_events this decay run just
  // inserted" without depending on freeze_events.applied_date matching this
  // function's own idea of "today" - Postgres and Deno can disagree on
  // calendar day right around a UTC/IST boundary.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase.from("freeze_events")
    .select("owner_id, family_member_id, streak_preserved")
    .gte("created_at", since);
  if (!events?.length) return json({ message: "no freeze events" });

  const ownerIds = [...new Set(events.map((e: any) => e.owner_id))];
  const familyIds = events.map((e: any) => e.family_member_id).filter(Boolean);

  const [{ data: subs }, { data: profiles }, { data: family }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key, platform").in("user_id", ownerIds),
    supabase.from("profiles").select("id, freeze_credits").in("id", ownerIds),
    familyIds.length
      ? supabase.from("family_members").select("id, name").in("id", familyIds)
      : Promise.resolve({ data: [] }),
  ]);
  const freezeByOwner = new Map((profiles ?? []).map((p: any) => [p.id, p.freeze_credits]));
  const nameByFamilyId = new Map((family ?? []).map((f: any) => [f.id, f.name]));

  // One push per owner - a parent tracking kids can have several
  // freeze_events (self + each child) land in the same run.
  const byOwner = new Map<string, { who: string; streak: number }[]>();
  for (const ev of events) {
    const who = ev.family_member_id ? nameByFamilyId.get(ev.family_member_id) ?? "your child" : "you";
    const list = byOwner.get(ev.owner_id) ?? [];
    list.push({ who, streak: ev.streak_preserved });
    byOwner.set(ev.owner_id, list);
  }

  let sent = 0;
  const today = new Date().toISOString().slice(0, 10);
  const title = "Streak saved by a freeze";
  for (const [ownerId, items] of byOwner) {
    const body = items.length === 1
      ? `Namaskaram! A freeze protected ${items[0].who === "you" ? "your" : `${items[0].who}'s`} ${items[0].streak}-day streak. ${freezeByOwner.get(ownerId) ?? 0} freeze(s) left.`
      : `Namaskaram! A freeze protected ${items.length} streaks today (${items.map((i) => i.who).join(", ")}).`;

    for (const sub of (subs ?? []).filter((s: any) => s.user_id === ownerId)) {
      const { error: insErr } = await supabase.from("notification_deliveries")
        .insert({ user_id: ownerId, reminder_date: today, slot: "freeze_applied", endpoint: sub.endpoint.slice(0, 500) });
      if (insErr) {
        if (insErr.code === "23505") continue; // already sent today
        console.error("delivery insert failed", { slot: "freeze_applied", code: insErr.code, message: insErr.message });
        continue;
      }
      const ok = sub.platform === "android"
        ? await sendFCM(supabase, config, sub.endpoint, title, body, "freeze_applied")
        : await sendWebPush(supabase, config, sub, title, body);
      if (ok) sent++;
    }
  }
  return json({ message: "done", sent });
});

function json(obj: unknown) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
