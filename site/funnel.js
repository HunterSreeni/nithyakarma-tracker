// Marketing-site funnel tracking (docs/MARKETING-FUNNEL-PLAN.md, Phase 0a).
// AI-DEV NOTE: deliberately tiny and cookieless - no PostHog SDK, no cookies, no
// localStorage, no person profiles. One random visitor id + session id per browser
// TAB, kept in sessionStorage (the browser deletes it when the tab closes), because
// PostHog Web Analytics builds sessions/bounce rate from $session_id. It sends
// $pageview and cta_clicked to PostHog EU through the same-origin /ingest proxy
// (site/netlify.toml), and forwards the visit's utm_* to the web-app and Play
// links so the app can attribute the signup. Only utm_* query params are sent.
export const KEY = 'phc_tYYxFeq2QefDwSYXVMjLgnTUi9RatVtShfxtYovUcReh'
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

// The visit's real campaign tags (sent with the pageview, so PostHog's channel
// attribution still sees untagged visits as direct/referral).
export function readUtms(search) {
  const params = new URLSearchParams(search)
  const out = {}
  for (const k of UTM) { const v = params.get(k); if (v) out[k] = v.slice(0, 100) }
  return out
}

// Tags forwarded on outbound app/Play links: the visit's own, or utm_source=site.
export function visitUtms(search) {
  const out = readUtms(search)
  if (!out.utm_source) { out.utm_source = 'site'; out.utm_medium = out.utm_medium || 'website' }
  return out
}

// Adds the visit's UTMs to a web-app link. Existing params and #fragment are kept;
// a utm_* the link already carries is not overwritten.
export function withUtms(href, utms) {
  const u = new URL(href)
  for (const [k, v] of Object.entries(utms)) if (!u.searchParams.has(k)) u.searchParams.set(k, v)
  return u.toString()
}

// Play Store link: UTMs travel inside ONE `referrer` param (encoded exactly once),
// which Play hands back to the installed app via the Install Referrer API.
export function withPlayReferrer(href, utms) {
  const u = new URL(href)
  if (u.searchParams.has('referrer')) return href
  u.searchParams.set('referrer', new URLSearchParams(utms).toString())
  return u.toString()
}

export function cleanUrl(href) {
  const u = new URL(href)
  const kept = new URLSearchParams()
  for (const k of UTM) if (u.searchParams.has(k)) kept.set(k, u.searchParams.get(k))
  const qs = kept.toString()
  return `${u.origin}${u.pathname}${qs ? `?${qs}` : ''}`
}

// UUIDv7 (48-bit ms timestamp + random), the format PostHog uses for $session_id.
export function uuidv7(now = Date.now(), rand = n => crypto.getRandomValues(new Uint8Array(n))) {
  const b = rand(16)
  let t = now
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256) }
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const SESSION_KEY = 'nk_visit'
const SESSION_IDLE_MS = 30 * 60 * 1000

// Same tab within 30 idle minutes = same visit. Falls back to a per-page id when
// sessionStorage is unavailable (private mode, blocked storage).
export function visitIds(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null')
    const ids = saved && now - saved.last < SESSION_IDLE_MS ? saved : { visitor: uuidv7(now), session: uuidv7(now) }
    storage.setItem(SESSION_KEY, JSON.stringify({ ...ids, last: now }))
    return { visitor: ids.visitor, session: ids.session }
  } catch {
    const id = uuidv7(now)
    return { visitor: id, session: id }
  }
}

export function payload(event, properties, distinctId) {
  return {
    api_key: KEY,
    event,
    distinct_id: distinctId,
    properties: { ...properties, $process_person_profile: false, $lib: 'nithyakarma-site' },
  }
}

function send(event, properties, distinctId) {
  try {
    fetch('/ingest/i/v0/e/', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(event, properties, distinctId)),
    }).catch(() => {})
  } catch { /* analytics never breaks the page */ }
}

export function run(win = window, doc = document) {
  const utms = visitUtms(win.location.search)
  const real = readUtms(win.location.search)
  // Reading sessionStorage itself can throw (blocked site data); visitIds falls back.
  let storage = null
  try { storage = win.sessionStorage } catch { /* blocked */ }
  const { visitor: id, session } = visitIds(storage)
  const page = {
    $session_id: session,
    $host: win.location.host,
    $current_url: cleanUrl(win.location.href),
    $pathname: win.location.pathname,
    $referrer: doc.referrer ? cleanUrl(doc.referrer) : '$direct',
    ...real,
  }
  send('$pageview', page, id)
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')
    let target = null
    if (/^https:\/\/app\.nithyakarma\.org/.test(href)) { a.href = withUtms(href, utms); target = 'webapp' }
    else if (/^https:\/\/play\.google\.com\/store\/apps\/details\?id=org\.nithyakarma\.app/.test(href)) { a.href = withPlayReferrer(href, utms); target = 'playstore' }
    if (target) a.addEventListener('click', () => send('cta_clicked', { target, $session_id: session, $current_url: page.$current_url, ...real }, id))
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__NK_FUNNEL_TEST__) run()
