// Revokes the caller's Sign in with Apple tokens right before the app deletes
// their account (Apple TN3194). The app gets a fresh authorization code from
// Apple's sheet and sends it here; we exchange it, confirm the Apple account is
// the caller's own, and revoke. The app then runs delete_account as before.
//
// Deploy with verify_jwt = true, AND check the user here: verify_jwt also lets
// the public publishable key through (memory edge-fn-verify-jwt-not-auth).
// Secrets: APPLE_SIWA_KEY_P8 (the Sign in with Apple .p8 text), APPLE_SIWA_KEY_ID,
// APPLE_TEAM_ID.
// AI-DEV NOTE: redeploy via the Supabase MCP after any change (edge functions do
// not deploy from CI - memory edge-fn-deploy-drift).
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  APPLE_KEYS_URL, type AppleJwk, appleSubject, buildClientSecret, exchangeAndRevoke,
} from "../_shared/appleRevoke.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUNDLE_ID = "org.nithyakarma.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 200 even for failures: functions.invoke() drops the body of non-2xx replies,
// and the app only needs revoked true/false (deletion goes ahead either way).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

async function appleKeys(): Promise<AppleJwk[]> {
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error(`apple keys ${res.status}`);
  return (await res.json()).keys as AppleJwk[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let code: unknown;
  try {
    code = (await req.json())?.authorizationCode;
  } catch {
    code = null;
  }
  if (typeof code !== "string" || !code || code.length > 2048) return json({ error: "Bad request" }, 400);

  // Fail closed: only revoke the one Apple account linked to this user.
  const expectedSub = appleSubject(user.identities as never);
  if (!expectedSub) return json({ revoked: false, reason: "no_apple_identity" });

  const keyPem = Deno.env.get("APPLE_SIWA_KEY_P8");
  const keyId = Deno.env.get("APPLE_SIWA_KEY_ID");
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  if (!keyPem || !keyId || !teamId) {
    console.error("[apple-revoke] Apple key secrets missing");
    return json({ revoked: false, reason: "not_configured" });
  }

  try {
    const nowS = Math.floor(Date.now() / 1000);
    const clientSecret = await buildClientSecret({ keyPem, keyId, teamId, clientId: BUNDLE_ID, nowS });
    const outcome = await exchangeAndRevoke({
      code, clientId: BUNDLE_ID, clientSecret, expectedSub, keys: appleKeys, nowS,
    });
    if (!outcome.revoked) console.warn("[apple-revoke] not revoked", { reason: outcome.reason });
    return json(outcome);
  } catch (err) {
    console.error("[apple-revoke] failed", String(err));
    return json({ revoked: false, reason: "error" });
  }
});
