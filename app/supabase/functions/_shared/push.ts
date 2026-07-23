// Shared FCM/web-push sending code, used by both send-reminders (scheduled)
// and send-test-notification (on-demand). Parametrized on the caller's
// service-role client and config object rather than module-level state, so
// both functions can hold their own.
import webpush from "npm:web-push";

export const APP_URL = "https://app.nithyakarma.org";

export async function loadConfig(admin: any): Promise<Record<string, string>> {
  const { data } = await admin.from("app_config").select("key, value");
  return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let fcmAccessToken: string | null = null;
let fcmTokenExpiry = 0;

async function getFCMAccessToken(config: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAccessToken && now < fcmTokenExpiry - 60) return fcmAccessToken;
  const b64 = config.fcm_service_account_b64;
  if (!b64) throw new Error("fcm_service_account_b64 not configured");
  const serviceAccount = JSON.parse(atob(b64));
  const pemBody = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", base64ToBytes(pemBody),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  };
  const toSign = `${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))}.${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claim)))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${bytesToBase64Url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`FCM OAuth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  fcmAccessToken = data.access_token;
  fcmTokenExpiry = now + (data.expires_in || 3600);
  return fcmAccessToken!;
}

export async function sendFCM(
  admin: any, config: Record<string, string>,
  token: string, title: string, body: string, slot: string,
): Promise<boolean> {
  try {
    const accessToken = await getFCMAccessToken(config);
    const projectId = JSON.parse(atob(config.fcm_service_account_b64)).project_id;
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          android: { priority: "high", notification: { channel_id: "reminders", color: "#FF9933" } },
          data: { url: APP_URL, slot },
        },
      }),
    });
    if (res.ok) return true;
    const err = await res.json();
    const errorCode = (err as any)?.error?.details?.[0]?.errorCode || "";
    if (errorCode === "UNREGISTERED" || errorCode === "SENDER_ID_MISMATCH") {
      await admin.from("push_subscriptions").delete().eq("endpoint", token);
    }
    return false;
  } catch (err) {
    console.error("[push] sendFCM failed", err);
    return false;
  }
}

export async function sendWebPush(
  admin: any, config: Record<string, string>,
  sub: { endpoint: string; p256dh: string; auth_key: string }, title: string, body: string,
): Promise<boolean> {
  webpush.setVapidDetails(config.vapid_email, config.vapid_public_key, config.vapid_private_key);
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      JSON.stringify({ title, body, url: APP_URL }),
    );
    return true;
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    } else {
      console.error("[push] sendWebPush failed", err);
    }
    return false;
  }
}
