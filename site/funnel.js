// Marketing-site funnel tracking (docs/MARKETING-FUNNEL-PLAN.md, Phase 0a).
// AI-DEV NOTE: deliberately tiny and cookieless - no PostHog SDK, no cookies, no
// localStorage, a fresh random id per page view, no person profiles. It sends
// $pageview and cta_clicked to PostHog EU through the same-origin /ingest proxy
// (site/netlify.toml), and forwards the visit's utm_* to the web-app and Play
// links so the app can attribute the signup. Only utm_* query params are sent.
export const KEY = 'phc_tYYxFeq2QefDwSYXVMjLgnTUi9RatVtShfxtYovUcReh'
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

export function visitUtms(search) {
  const params = new URLSearchParams(search)
  const out = {}
  for (const k of UTM) { const v = params.get(k); if (v) out[k] = v.slice(0, 100) }
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

const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

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
  const id = randomId()
  const page = {
    $current_url: cleanUrl(win.location.href),
    $pathname: win.location.pathname,
    $referrer: doc.referrer ? cleanUrl(doc.referrer) : '$direct',
    ...utms,
  }
  send('$pageview', page, id)
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')
    let target = null
    if (/^https:\/\/app\.nithyakarma\.org/.test(href)) { a.href = withUtms(href, utms); target = 'webapp' }
    else if (/^https:\/\/play\.google\.com\/store\/apps\/details\?id=org\.nithyakarma\.app/.test(href)) { a.href = withPlayReferrer(href, utms); target = 'playstore' }
    if (target) a.addEventListener('click', () => send('cta_clicked', { target, $current_url: page.$current_url, ...utms }, id))
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__NK_FUNNEL_TEST__) run()
