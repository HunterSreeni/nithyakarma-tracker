// Run with: deno test supabase/functions/_shared/admobSsv.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  adUnitMatches, base64UrlDecode, derToP1363, grantFields, importVerifierKeys, parseSsvQuery, verifySsv,
} from "./admobSsv.ts"

const GRANT = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"
const USER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

// WebCrypto signs as raw r||s; Google sends DER. Encode the way a DER signer would.
function p1363ToDer(raw: Uint8Array): Uint8Array {
  const int = (v: Uint8Array) => {
    let i = 0
    while (i < v.length - 1 && v[i] === 0) i++
    let t = v.slice(i)
    if (t[0] & 0x80) t = new Uint8Array([0, ...t])
    return new Uint8Array([0x02, t.length, ...t])
  }
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32))
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s])
}

async function signer() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))
  const keys = await importVerifierKeys({ keys: [{ keyId: 3335741209, base64: b64(spki) }] })
  const sign = async (message: string) => {
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(message)))
    return b64url(p1363ToDer(raw))
  }
  return { keys, sign }
}

// A callback shaped like Google's: alphabetical params, then signature and key_id last.
const body = (over: Record<string, string> = {}) => {
  const p = { ad_network: "5450213213286189855", ad_unit: "1234567890", custom_data: GRANT, reward_amount: "1",
    reward_item: "download", timestamp: "1794990000000", transaction_id: "123456789abcdef", user_id: USER, ...over }
  return Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
}

Deno.test("accepts a correctly signed callback and exposes its grant", async () => {
  const { keys, sign } = await signer()
  const msg = body()
  const cb = parseSsvQuery(`${msg}&signature=${await sign(msg)}&key_id=3335741209`)!
  assert(cb)
  assertEquals(cb.message, msg)
  assertEquals(await verifySsv(cb, keys), true)
  assertEquals(grantFields(cb.params), { grant: GRANT, user: USER, transaction: "123456789abcdef" })
})

Deno.test("rejects a callback whose content was changed after signing", async () => {
  const { keys, sign } = await signer()
  const msg = body()
  const forged = msg.replace(USER, "11111111-2222-4333-8444-555555555555")
  const cb = parseSsvQuery(`${forged}&signature=${await sign(msg)}&key_id=3335741209`)!
  assertEquals(await verifySsv(cb, keys), false)
})

Deno.test("rejects an unknown key id and a signature from another key", async () => {
  const a = await signer(), b = await signer()
  const msg = body()
  const unknown = parseSsvQuery(`${msg}&signature=${await a.sign(msg)}&key_id=42`)!
  assertEquals(await verifySsv(unknown, a.keys), false)
  const other = parseSsvQuery(`${msg}&signature=${await b.sign(msg)}&key_id=3335741209`)!
  assertEquals(await verifySsv(other, a.keys), false)
})

Deno.test("verifies when Google signed the decoded form of an escaped value", async () => {
  const { keys, sign } = await signer()
  const msg = body({ reward_item: "one download" })
  assert(msg.includes("one%20download"))
  const cb = parseSsvQuery(`${msg}&signature=${await sign(decodeURIComponent(msg))}&key_id=3335741209`)!
  assertEquals(await verifySsv(cb, keys), true)
})

Deno.test("refuses malformed callbacks", () => {
  assertEquals(parseSsvQuery(""), null)
  assertEquals(parseSsvQuery(body()), null) // no signature
  assertEquals(parseSsvQuery(`${body()}&signature=abc`), null) // no key_id
  assertEquals(parseSsvQuery(`${body()}&signature=abc&key_id=notanumber`), null)
  assertEquals(parseSsvQuery(`signature=abc&key_id=1`), null) // nothing signed before it
})

Deno.test("converts DER to raw r||s, padding and trimming the integers", () => {
  const r = new Uint8Array(32).fill(1); r[0] = 0x80 // high bit set: DER adds a 0x00
  const s = new Uint8Array(32).fill(2); s[0] = 0; s[1] = 0x05 // leading zero: DER trims it
  const raw = derToP1363(p1363ToDer(new Uint8Array([...r, ...s])))!
  assertEquals(raw.slice(0, 32), r)
  assertEquals(raw.slice(32), s)
  assertEquals(derToP1363(new Uint8Array([0x31, 0])), null)
})

Deno.test("rejects malformed DER: wrong lengths, trailing bytes, truncation", () => {
  const good = p1363ToDer(new Uint8Array(64).fill(7))
  assert(derToP1363(good))
  assertEquals(derToP1363(new Uint8Array([...good, 0])), null) // trailing byte
  assertEquals(derToP1363(good.slice(0, good.length - 1)), null) // truncated
  const badSeq = good.slice(); badSeq[1] += 1
  assertEquals(derToP1363(badSeq), null) // sequence length lies
  assertEquals(derToP1363(new Uint8Array([0x30, 0x84, 0, 0, 0, 4, 2, 1, 1, 2, 1, 1])), null) // 4-byte length form
  assertEquals(derToP1363(new Uint8Array([0x30, 4, 2, 0, 2, 0])), null) // empty integers
})

Deno.test("decodes URL-safe base64 with or without padding", () => {
  assertEquals(base64UrlDecode("_-8"), new Uint8Array([0xff, 0xef]))
  assertEquals(base64UrlDecode("_-8="), new Uint8Array([0xff, 0xef]))
})

Deno.test("checks the ad unit against the configured rewarded unit", () => {
  assert(adUnitMatches("1234567890", undefined))
  assert(adUnitMatches("1234567890", "ca-app-pub-2677287550445019/1234567890"))
  assert(adUnitMatches("1234567890", "1234567890"))
  assert(!adUnitMatches("999", "ca-app-pub-2677287550445019/1234567890"))
  assert(!adUnitMatches(null, "1234567890"))
})

Deno.test("needs a grant id, a user id and a transaction id", () => {
  assertEquals(grantFields(new URLSearchParams(body({ custom_data: "" }))), null)
  assertEquals(grantFields(new URLSearchParams(body({ user_id: "not-a-uuid" }))), null)
  assertEquals(grantFields(new URLSearchParams(body({ transaction_id: "" }))), null)
})
