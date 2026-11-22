// AdMob rewarded-ad server-side verification (SSV), as specified at
// https://developers.google.com/admob/android/ssv (read 2026-11-18):
// - the last two query parameters are always `signature` then `key_id`
// - the signed content is the query string before "&signature="
// - ECDSA P-256 / SHA-256, DER-encoded signature in URL-safe base64
// - public keys from https://www.gstatic.com/admob/reward/verifier-keys.json,
//   {keys: [{keyId, pem, base64}]} with base64 = SPKI DER; cache at most 24h.
//
// AI-DEV NOTE: this is the only thing that can make a Jadhagam download
// "rewarded". The app's own "video finished" event is never trusted on its own.
// Pure functions (no I/O except the injected fetch) so they are unit-tested.

export const VERIFIER_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
export const KEY_CACHE_MS = 24 * 60 * 60 * 1000;

export interface SsvCallback {
  message: string; // the exact bytes Google signed
  signature: Uint8Array<ArrayBuffer>; // DER
  keyId: string;
  params: URLSearchParams;
}

export function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// rawQuery: the query string exactly as received, without the leading "?".
export function parseSsvQuery(rawQuery: string): SsvCallback | null {
  const at = rawQuery.indexOf("&signature=");
  if (at <= 0) return null;
  const tail = rawQuery.slice(at + "&signature=".length);
  const keyAt = tail.indexOf("&key_id=");
  if (keyAt <= 0) return null;
  const sig = decodeURIComponent(tail.slice(0, keyAt));
  const keyId = decodeURIComponent(tail.slice(keyAt + "&key_id=".length));
  if (!sig || !/^\d+$/.test(keyId)) return null;
  try {
    return { message: rawQuery.slice(0, at), signature: base64UrlDecode(sig), keyId, params: new URLSearchParams(rawQuery) };
  } catch {
    return null;
  }
}

// WebCrypto ECDSA wants the raw r||s form (64 bytes for P-256), not DER.
// Strict: SEQUENCE { INTEGER r, INTEGER s } with exact lengths and nothing after.
export function derToP1363(der: Uint8Array, size = 32): Uint8Array<ArrayBuffer> | null {
  let i = 0;
  const byte = (): number | null => (i < der.length ? der[i++] : null);
  const length = (): number | null => {
    const first = byte();
    if (first === null) return null;
    if (first < 0x80) return first;
    const count = first & 0x7f;
    if (count === 0 || count > 2) return null; // a P-256 signature is never longer
    let n = 0;
    for (let k = 0; k < count; k++) {
      const b = byte();
      if (b === null) return null;
      n = (n << 8) | b;
    }
    return n;
  };
  if (byte() !== 0x30) return null;
  const seqLen = length();
  if (seqLen === null || i + seqLen !== der.length) return null;
  const readInt = (): Uint8Array<ArrayBuffer> | null => {
    if (byte() !== 0x02) return null;
    const n = length();
    if (n === null || n === 0 || i + n > der.length) return null;
    let v = der.slice(i, i + n);
    i += n;
    while (v.length > size && v[0] === 0) v = v.slice(1);
    if (v.length > size) return null;
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  if (!r || !s || i !== der.length) return null;
  const out = new Uint8Array(size * 2);
  out.set(r, 0);
  out.set(s, size);
  return out;
}

export type KeyMap = Map<string, CryptoKey>;

export async function importVerifierKeys(json: { keys?: { keyId: number | string; base64: string }[] }): Promise<KeyMap> {
  const map: KeyMap = new Map();
  for (const k of json.keys ?? []) {
    const der = Uint8Array.from(atob(k.base64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    map.set(String(k.keyId), key);
  }
  return map;
}

// Verifies Google's signature. The spec's Java sample signs the query as decoded
// by getQuery(), while the raw string keeps percent escapes; custom_data is the only
// field that can carry escapes, so both forms are tried. Either needs a valid signature.
export async function verifySsv(cb: SsvCallback, keys: KeyMap): Promise<boolean> {
  const key = keys.get(cb.keyId);
  if (!key) return false;
  const raw = derToP1363(cb.signature);
  if (!raw) return false;
  const candidates = [cb.message];
  try {
    const decoded = decodeURIComponent(cb.message);
    if (decoded !== cb.message) candidates.push(decoded);
  } catch { /* malformed escapes: raw form only */ }
  for (const m of candidates) {
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, new TextEncoder().encode(m));
    if (ok) return true;
  }
  return false;
}

// AdMob reports the ad unit as its numeric id; config may hold the full
// "ca-app-pub-XXX/NNN" form. Empty expectation means "any of our ad units".
// AI-DEV NOTE: config is a comma-separated list since iOS got its own rewarded
// unit (2026-11-22): Android .../3600927444 and iOS .../4791412117. A unit not
// on the list never rewards.
export function adUnitMatches(reported: string | null, expected: string | undefined): boolean {
  if (!expected?.trim()) return true;
  if (!reported) return false;
  return expected.split(",").map((e) => e.trim()).filter(Boolean).some((entry) => {
    const want = entry.includes("/") ? entry.split("/").pop() : entry;
    return reported === want || reported === entry;
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The fields the grant update needs, or null when the callback cannot name one.
export function grantFields(params: URLSearchParams): { grant: string; user: string; transaction: string } | null {
  const grant = params.get("custom_data") ?? "";
  const user = params.get("user_id") ?? "";
  const transaction = params.get("transaction_id") ?? "";
  if (!UUID.test(grant) || !UUID.test(user) || !transaction) return null;
  return { grant, user, transaction };
}
