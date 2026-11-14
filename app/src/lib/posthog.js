import { Capacitor } from '@capacitor/core'

// AI-DEV NOTE: PostHog (EU) product analytics for the marketing funnel
// (docs/MARKETING-FUNNEL-PLAN.md, Phase 0a). Privacy rules that must hold:
// - Only allow-listed event props leave the device (ALLOWED_PROPS). Ritual detail
//   (which practice, sandhya/rudram/samidha flags), gender, names and email never do.
// - No autocapture, session replay, heatmaps, surveys, flags or remote scripts.
// - URLs are sanitised before send: referral codes and every non-utm_* query param
//   are stripped (they can carry referral codes and OAuth tokens).
// The project key is a public client key by design (like the Supabase anon key).
const DEFAULT_KEY = 'phc_tYYxFeq2QefDwSYXVMjLgnTUi9RatVtShfxtYovUcReh'
const KEY = import.meta.env.VITE_POSTHOG_KEY || DEFAULT_KEY

// Web goes through the same-origin Netlify proxy (/ingest, see netlify.toml) so the
// CSP stays connect-src 'self' and ad-blockers do not drop events. The Android
// WebView has no CSP and its origin is https://localhost, so it talks to EU directly.
export const apiHost = () => (Capacitor.isNativePlatform() ? 'https://eu.i.posthog.com' : '/ingest')

export const ALLOWED_PROPS = [
  'day_complete', 'freeze_used', 'overall_streak', 'from', 'referred',
  // app_first_open: campaign tags from the Play install referrer + whether the
  // device already had a signed-in account (an app update, not a new install).
  'install_utm_source', 'install_utm_medium', 'install_utm_campaign', 'install_utm_content', 'install_utm_term',
  'existing_user',
]

// 'web' | 'android' | 'ios' on every event, so dashboards split cleanly (the
// Android app otherwise shows up as a Chrome WebView "browser").
export const platform = () => (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web')

export function withPlatform(event) {
  if (event) event.properties = { ...event.properties, platform: platform() }
  return event
}

export function allowProps(props = {}) {
  const out = {}
  for (const k of ALLOWED_PROPS) if (props[k] !== undefined) out[k] = props[k]
  return out
}

const URL_PROPS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$pathname', '$initial_pathname']

export function sanitizeUrl(value) {
  if (typeof value !== 'string' || !value) return value
  const masked = value.replace(/\/r\/[A-Za-z0-9]+/g, '/r/:code')
  if (!/[?#]/.test(masked)) return masked
  try {
    const u = new URL(masked, 'https://placeholder.invalid')
    const kept = new URLSearchParams()
    for (const [k, v] of u.searchParams) if (k.startsWith('utm_')) kept.append(k, v)
    const qs = kept.toString()
    const path = `${u.pathname}${qs ? `?${qs}` : ''}`
    return u.origin === 'https://placeholder.invalid' ? path : `${u.origin}${path}`
  } catch {
    return masked.split(/[?#]/)[0]
  }
}

function sanitizeBag(bag) {
  if (!bag) return bag
  for (const k of URL_PROPS) if (k in bag) bag[k] = sanitizeUrl(bag[k])
  return bag
}

export function sanitizeEvent(event) {
  if (!event) return event
  sanitizeBag(event.properties)
  sanitizeBag(event.$set)
  sanitizeBag(event.$set_once)
  return event
}

// AI-DEV NOTE: loaded lazily (dynamic import) and from the "slim, no-external"
// build: it keeps ~120 KB gzip out of the startup bundle, and the slim build omits
// replay/surveys/autocapture code we never enable anyway. Calls made before it has
// loaded are queued and replayed in order.
const SDK = () => import('posthog-js/dist/module.slim.no-external')
let ph = null
let loading = null
const queue = []

function withPostHog(fn) {
  if (ph) fn(ph)
  else if (loading) queue.push(fn)
}

export function initAnalytics() {
  // Only real production builds report; dev servers and tests stay silent.
  if (loading || !import.meta.env.PROD || !KEY) return false
  loading = SDK().then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: apiHost(),
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      persistence: 'localStorage',
      capture_pageview: 'history_change',
      capture_pageleave: false,
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      before_send: event => withPlatform(sanitizeEvent(event)),
    })
    ph = posthog
    for (const fn of queue.splice(0)) fn(ph)
  }).catch(() => { queue.length = 0 })
  return true
}

export function capture(event, props) {
  const safe = allowProps(props)
  withPostHog(p => p.capture(event, safe))
}

export const isInternalEmail = email => typeof email === 'string' && /@nithyakarma\.test$/i.test(email)

// Ties the anonymous pre-signup journey to the account (first-touch attribution).
// If this device is already identified as someone else, start a fresh identity.
export function identifyUser(user, setOnce = {}) {
  if (!user?.id) return
  withPostHog(p => {
    if (p._isIdentified?.() && p.get_distinct_id() !== user.id) p.reset()
    p.identify(user.id, { is_internal: isInternalEmail(user.email) }, setOnce)
  })
}

export function resetAnalytics() {
  withPostHog(p => p.reset())
}

export function registerOnce(props) {
  withPostHog(p => p.register_once(props))
}

// Test hook only.
export function _resetForTests() { ph = null; loading = null; queue.length = 0 }
export const _whenLoaded = () => loading
