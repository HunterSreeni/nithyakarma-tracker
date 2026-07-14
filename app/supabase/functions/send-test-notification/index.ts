// On-demand test push, invoked by a signed-in user from the Notifications
// settings screen so push delivery can be verified without waiting for a
// scheduled reminder window. Unlike send-reminders (cron-secret bearer
// token), this is authenticated as the calling user via their own JWT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const config = await loadConfig(admin);

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, platform")
    .eq("user_id", user.id);

  if (!subs?.length) {
    return json({ error: "No active notification subscription found. Enable notifications first." }, 404);
  }

  const title = "Test notification 🔔";
  const body = "If you can see this, push notifications are working!";
  const results = [];
  let sent = 0;
  for (const sub of subs) {
    const ok = sub.platform === "android"
      ? await sendFCM(admin, config, sub.endpoint, title, body, "test")
      : await sendWebPush(admin, config, sub, title, body);
    if (ok) sent++;
    results.push({ platform: sub.platform, ok });
  }
  return json({ sent, total: subs.length, results });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
