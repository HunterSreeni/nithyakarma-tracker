// On-demand test push, invoked by a signed-in user from the Notifications
// settings screen so push delivery can be verified without waiting for a
// scheduled reminder window. Unlike send-reminders (cron-secret bearer
// token), this is authenticated as the calling user via their own JWT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { loadConfig, sendFCM, sendWebPush } from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// send-reminders never needed CORS handling (server-to-server, cron only).
// This function is called directly from the browser via
// supabase.functions.invoke(), which preflights on the Authorization header -
// without these headers the browser blocks the request before it's even sent.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

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
    // 200, not 404: supabase-js's functions.invoke() treats any non-2xx as a
    // generic FunctionsHttpError and discards the parsed body, which would
    // swallow this specific message the client is built to surface.
    return json({ error: "No active notification subscription found. Enable notifications first." });
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
