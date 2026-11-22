// Sign in with Apple token revocation for account deletion, as specified by
// Apple (read 2026-11-22):
// - TN3194 "Handling account deletions and revoking tokens for Sign in with Apple"
// - POST https://appleid.apple.com/auth/token (authorization_code -> refresh_token)
// - POST https://appleid.apple.com/auth/revoke (token + token_type_hint)
// - client_secret: ES256 JWT, header {alg, kid}, claims {iss: team id,
//   iat, exp (max 6 months), aud: https://appleid.apple.com, sub: client id}
// - ID tokens: RS256, keys at https://appleid.apple.com/auth/keys; check iss,
//   aud (our bundle id) and exp before trusting sub.
//
// AI-DEV NOTE: native-only Sign in with Apple, so the client id is the bundle
// id. The secret is minted per request and lives 5 minutes, so nothing here
// needs rotating every 6 months. Pure functions (fetch injected) so they are
// unit-tested in appleRevoke.test.ts.

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
export const CLIENT_SECRET_TTL_S = 300;

const enc = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const b64json = (v: unknown) => base64UrlEncode(enc.encode(JSON.stringify(v)));

// The .p8 file Apple hands out is a PKCS#8 PEM. Secrets pasted into a
// dashboard sometimes arrive with literal "\n", so accept both.
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("empty Apple key");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface ClientSecretInput {
  keyPem: string;
  keyId: string;
  teamId: string;
  clientId: string;
  nowS: number;
}

// WebCrypto ECDSA signs as raw r||s, which is exactly the JWS ES256 format.
export async function buildClientSecret(i: ClientSecretInput): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(i.keyPem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const signingInput = `${b64json({ alg: "ES256", kid: i.keyId })}.${b64json({
    iss: i.teamId, iat: i.nowS, exp: i.nowS + CLIENT_SECRET_TTL_S, aud: APPLE_ISSUER, sub: i.clientId,
  })}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export interface AppleJwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

// Returns the verified claims, or null for anything we cannot fully trust:
// unknown key, bad signature, wrong issuer/audience, expired, or no subject.
export async function verifyAppleIdToken(
  idToken: string, keys: AppleJwk[], clientId: string, nowS: number,
): Promise<{ sub: string } | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string | string[]; exp?: number; sub?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;
  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) return null;
  let ok = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, base64UrlDecode(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== APPLE_ISSUER || !aud.includes(clientId)) return null;
  if (typeof claims.exp !== "number" || claims.exp <= nowS) return null;
  if (!claims.sub) return null;
  return { sub: claims.sub };
}

export interface Identity {
  provider: string;
  id?: string;
  provider_id?: string;
  identity_data?: { sub?: string } | null;
}

// The caller's Apple subject, or null unless there is exactly one Apple
// identity with one unambiguous subject (fail closed). In this project
// auth.identities.provider_id equals identity_data.sub for every provider.
export function appleSubject(identities: Identity[] | null | undefined): string | null {
  const apple = (identities ?? []).filter((i) => i.provider === "apple");
  if (apple.length !== 1) return null;
  const ids = new Set(
    [apple[0].provider_id, apple[0].identity_data?.sub, apple[0].id].filter((v): v is string => !!v),
  );
  if (ids.size !== 1) return null;
  return [...ids][0];
}

export type RevokeOutcome =
  | { revoked: true }
  | { revoked: false; reason: "exchange_failed" | "bad_id_token" | "wrong_user" | "revoke_failed" };

// Exchange the single-use code (valid 5 minutes), check the returned ID token
// belongs to the caller, then revoke the refresh token. Never logs tokens.
export async function exchangeAndRevoke(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  expectedSub: string;
  keys: () => Promise<AppleJwk[]>;
  nowS: number;
  fetchFn?: typeof fetch;
}): Promise<RevokeOutcome> {
  const f = opts.fetchFn ?? fetch;
  const form = (o: Record<string, string>) => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(o).toString(),
  });
  const tokenRes = await f(APPLE_TOKEN_URL, form({
    client_id: opts.clientId, client_secret: opts.clientSecret, code: opts.code, grant_type: "authorization_code",
  }));
  if (!tokenRes.ok) return { revoked: false, reason: "exchange_failed" };
  const tokens = await tokenRes.json() as { refresh_token?: string; id_token?: string };
  if (!tokens.refresh_token || !tokens.id_token) return { revoked: false, reason: "exchange_failed" };

  const claims = await verifyAppleIdToken(tokens.id_token, await opts.keys(), opts.clientId, opts.nowS);
  if (!claims) return { revoked: false, reason: "bad_id_token" };
  if (claims.sub !== opts.expectedSub) return { revoked: false, reason: "wrong_user" };

  const revokeRes = await f(APPLE_REVOKE_URL, form({
    client_id: opts.clientId, client_secret: opts.clientSecret,
    token: tokens.refresh_token, token_type_hint: "refresh_token",
  }));
  return revokeRes.ok ? { revoked: true } : { revoked: false, reason: "revoke_failed" };
}
