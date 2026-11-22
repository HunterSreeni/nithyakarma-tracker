// Run with: deno test supabase/functions/_shared/appleRevoke.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  APPLE_ISSUER, APPLE_REVOKE_URL, APPLE_TOKEN_URL, type AppleJwk, appleSubject, base64UrlDecode, base64UrlEncode,
  buildClientSecret, CLIENT_SECRET_TTL_S, exchangeAndRevoke, pemToPkcs8, verifyAppleIdToken,
} from "./appleRevoke.ts"

const BUNDLE = "org.nithyakarma.app"
const NOW = 1_795_000_000
const SUB = "001234.abcdef0123456789.0042"
const enc = new TextEncoder()
const b64json = (v: unknown) => base64UrlEncode(enc.encode(JSON.stringify(v)))
const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(base64UrlDecode(s)))

async function ecKeyPem() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n")
  return { pem: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`, publicKey: pair.publicKey }
}

// A stand-in for Apple: an RSA key published as a JWK, signing RS256 ID tokens.
async function fakeApple(kid = "apple-kid-1") {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"],
  )
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey)
  const key: AppleJwk = { kid, kty: "RSA", alg: "RS256", n: jwk.n!, e: jwk.e! }
  const sign = async (claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid }) => {
    const input = `${b64json(header)}.${b64json(claims)}`
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, enc.encode(input))
    return `${input}.${base64UrlEncode(new Uint8Array(sig))}`
  }
  return { key, sign }
}

const goodClaims = { iss: APPLE_ISSUER, aud: BUNDLE, exp: NOW + 600, iat: NOW, sub: SUB }

Deno.test("client secret is an ES256 JWT Apple accepts: right header, claims and a valid signature", async () => {
  const { pem, publicKey } = await ecKeyPem()
  const jwt = await buildClientSecret({ keyPem: pem, keyId: "KEYID12345", teamId: "M3KBNG884H", clientId: BUNDLE, nowS: NOW })
  const [h, c, s] = jwt.split(".")
  assertEquals(decodeJson(h), { alg: "ES256", kid: "KEYID12345" })
  assertEquals(decodeJson(c), { iss: "M3KBNG884H", iat: NOW, exp: NOW + CLIENT_SECRET_TTL_S, aud: APPLE_ISSUER, sub: BUNDLE })
  const sig = base64UrlDecode(s)
  assertEquals(sig.length, 64) // raw r||s, the JWS form
  assert(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sig, enc.encode(`${h}.${c}`)))
})

Deno.test("the .p8 text is accepted with real or escaped newlines", async () => {
  const { pem } = await ecKeyPem()
  assertEquals(pemToPkcs8(pem.replace(/\n/g, "\\n")), pemToPkcs8(pem))
})

Deno.test("an Apple ID token is trusted only when signature, issuer, audience and expiry all check out", async () => {
  const apple = await fakeApple()
  const keys = [apple.key]
  assertEquals(await verifyAppleIdToken(await apple.sign(goodClaims), keys, BUNDLE, NOW), { sub: SUB })
  assertEquals(await verifyAppleIdToken(await apple.sign({ ...goodClaims, aud: [BUNDLE] }), keys, BUNDLE, NOW), { sub: SUB })

  assertEquals(await verifyAppleIdToken(await apple.sign({ ...goodClaims, aud: "com.other.app" }), keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken(await apple.sign({ ...goodClaims, iss: "https://evil.example" }), keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken(await apple.sign({ ...goodClaims, exp: NOW }), keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken(await apple.sign({ ...goodClaims, sub: undefined }), keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken(await apple.sign(goodClaims, { alg: "none", kid: "apple-kid-1" }), keys, BUNDLE, NOW), null)

  // Signed by a key Apple never published, or under an unknown kid.
  const impostor = await fakeApple()
  assertEquals(await verifyAppleIdToken(await impostor.sign(goodClaims), keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken(await apple.sign(goodClaims, { alg: "RS256", kid: "other" }), keys, BUNDLE, NOW), null)

  // Claims edited after signing.
  const [h, , s] = (await apple.sign(goodClaims)).split(".")
  assertEquals(await verifyAppleIdToken(`${h}.${b64json({ ...goodClaims, sub: "someone-else" })}.${s}`, keys, BUNDLE, NOW), null)
  assertEquals(await verifyAppleIdToken("not-a-jwt", keys, BUNDLE, NOW), null)
})

Deno.test("the Apple subject comes only from exactly one, unambiguous Apple identity", () => {
  assertEquals(appleSubject([{ provider: "google", id: "g1" }, { provider: "apple", id: SUB, identity_data: { sub: SUB } }]), SUB)
  assertEquals(appleSubject([{ provider: "google", id: "g1" }]), null)
  assertEquals(appleSubject([]), null)
  assertEquals(appleSubject(null), null)
  assertEquals(appleSubject([{ provider: "apple", id: SUB }, { provider: "apple", id: "other" }]), null)
  assertEquals(appleSubject([{ provider: "apple", id: SUB, identity_data: { sub: "different" } }]), null)
  assertEquals(appleSubject([{ provider: "apple" }]), null)
})

function fakeFetch(apple: Awaited<ReturnType<typeof fakeApple>>, opts: { tokenStatus?: number; revokeStatus?: number; sub?: string } = {}) {
  const calls: { url: string; body: URLSearchParams }[] = []
  const fn = (async (url: string, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body))
    calls.push({ url, body })
    if (url === APPLE_TOKEN_URL) {
      if ((opts.tokenStatus ?? 200) !== 200) return new Response("{}", { status: opts.tokenStatus })
      const id_token = await apple.sign({ ...goodClaims, sub: opts.sub ?? SUB })
      return Response.json({ refresh_token: "rt-secret", id_token, access_token: "at" })
    }
    if (url === APPLE_REVOKE_URL) return new Response("", { status: opts.revokeStatus ?? 200 })
    return new Response("", { status: 404 })
  }) as typeof fetch
  return { fn, calls }
}

const run = async (apple: Awaited<ReturnType<typeof fakeApple>>, f: ReturnType<typeof fakeFetch>) =>
  exchangeAndRevoke({
    code: "c0de", clientId: BUNDLE, clientSecret: "secret-jwt", expectedSub: SUB,
    keys: () => Promise.resolve([apple.key]), nowS: NOW, fetchFn: f.fn,
  })

Deno.test("exchanges the code, then revokes the refresh token it got back", async () => {
  const apple = await fakeApple()
  const f = fakeFetch(apple)
  assertEquals(await run(apple, f), { revoked: true })
  assertEquals(f.calls.map((c) => c.url), [APPLE_TOKEN_URL, APPLE_REVOKE_URL])
  assertEquals(Object.fromEntries(f.calls[0].body), {
    client_id: BUNDLE, client_secret: "secret-jwt", code: "c0de", grant_type: "authorization_code",
  })
  assertEquals(Object.fromEntries(f.calls[1].body), {
    client_id: BUNDLE, client_secret: "secret-jwt", token: "rt-secret", token_type_hint: "refresh_token",
  })
})

Deno.test("never revokes an Apple account that is not the caller's own", async () => {
  const apple = await fakeApple()
  const f = fakeFetch(apple, { sub: "001234.someone.else" })
  assertEquals(await run(apple, f), { revoked: false, reason: "wrong_user" })
  assertEquals(f.calls.length, 1)
})

Deno.test("reports failed exchanges and revokes instead of claiming success", async () => {
  const apple = await fakeApple()
  assertEquals(await run(apple, fakeFetch(apple, { tokenStatus: 400 })), { revoked: false, reason: "exchange_failed" })
  assertEquals(await run(apple, fakeFetch(apple, { revokeStatus: 400 })), { revoked: false, reason: "revoke_failed" })
  const impostor = await fakeApple()
  assertEquals(
    await exchangeAndRevoke({
      code: "c0de", clientId: BUNDLE, clientSecret: "s", expectedSub: SUB,
      keys: () => Promise.resolve([apple.key]), nowS: NOW, fetchFn: fakeFetch(impostor).fn,
    }),
    { revoked: false, reason: "bad_id_token" },
  )
})
