// AdMob rewarded-ad SSV callback. Google calls this URL (configured on the
// rewarded ad unit in AdMob) after a user finishes a rewarded video; we check
// Google's signature and mark the matching Jadhagam reward grant verified.
//
// Deploy with verify_jwt = false: Google cannot send a Supabase JWT. Safety comes
// from the ECDSA signature, the expected ad unit, the pending grant that must
// belong to the user in user_id, and the unique transaction_id (no replays).
// AI-DEV NOTE: redeploy via the Supabase MCP after any change (edge functions do
// not deploy from CI - memory edge-fn-deploy-drift).
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  adUnitMatches, grantFields, importVerifierKeys, KEY_CACHE_MS, type KeyMap, parseSsvQuery, verifySsv,
  VERIFIER_KEYS_URL,
} from "../_shared/admobSsv.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let keys: KeyMap | null = null;
let keysAt = 0;

async function verifierKeys(force = false): Promise<KeyMap> {
  if (!force && keys && Date.now() - keysAt < KEY_CACHE_MS) return keys;
  const res = await fetch(VERIFIER_KEYS_URL);
  if (!res.ok) throw new Error(`verifier keys ${res.status}`);
  keys = await importVerifierKeys(await res.json());
  keysAt = Date.now();
  return keys;
}

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return text("Method not allowed", 405);
  const raw = new URL(req.url).search.replace(/^\?/, "");
  // AdMob's "verify URL" check in the console sends a request without a reward.
  if (!raw) return text("ok");

  const cb = parseSsvQuery(raw);
  if (!cb) return text("Malformed callback", 400);

  let ok = false;
  try {
    let map = await verifierKeys();
    // A key id we have not seen means Google rotated keys: refetch once.
    if (!map.has(cb.keyId)) map = await verifierKeys(true);
    ok = await verifySsv(cb, map);
  } catch (err) {
    console.error("[admob-ssv] key fetch or verify failed", String(err));
    return text("Verifier unavailable", 503); // Google retries non-200s
  }
  if (!ok) {
    console.warn("[admob-ssv] bad signature", { keyId: cb.keyId });
    return text("Bad signature", 403);
  }

  // AI-DEV NOTE: fail closed - if the expected unit cannot be read, answer 500 so
  // Google retries, rather than treating "unknown" as "any unit is fine".
  const { data: cfg, error: cfgErr } = await supabase.from("app_config")
    .select("value").eq("key", "admob_rewarded_ad_unit").maybeSingle();
  if (cfgErr) {
    console.error("[admob-ssv] app_config read failed", { code: cfgErr.code });
    return text("Config unavailable", 500);
  }
  if (!adUnitMatches(cb.params.get("ad_unit"), cfg?.value ?? undefined)) {
    console.warn("[admob-ssv] unexpected ad unit", { adUnit: cb.params.get("ad_unit") });
    return text("ok"); // genuine Google callback, just not ours to reward: don't make it retry
  }

  const f = grantFields(cb.params);
  if (!f) {
    console.warn("[admob-ssv] callback without a grant");
    return text("ok");
  }
  const { data, error } = await supabase.rpc("verify_jadhagam_reward", {
    p_grant: f.grant, p_user: f.user, p_transaction: f.transaction,
  });
  if (error) {
    console.error("[admob-ssv] verify_jadhagam_reward failed", { code: error.code, message: error.message });
    return text("Database error", 500); // retryable
  }
  if (!data) console.warn("[admob-ssv] no pending grant matched", { grant: f.grant });
  return text("ok");
});
