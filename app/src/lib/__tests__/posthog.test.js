import { describe, it, expect, vi, beforeEach } from 'vitest'

const ph = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), register_once: vi.fn(),
  get_distinct_id: vi.fn(() => 'anon-1'), _isIdentified: vi.fn(() => false),
}))
vi.mock('posthog-js/dist/module.slim.no-external', () => ({ default: ph }))
const native = vi.hoisted(() => ({ value: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value, getPlatform: () => (native.value ? 'android' : 'web') } }))

import {
  allowProps, sanitizeUrl, sanitizeEvent, initAnalytics, capture, identifyUser, resetAnalytics,
  registerOnce, isInternalEmail, apiHost, ALLOWED_PROPS, _resetForTests, _whenLoaded, withPlatform,
} from '../posthog'

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTests()
  native.value = false
  vi.stubEnv('PROD', true)
})

describe('allowProps', () => {
  it('keeps only allow-listed props and drops ritual flags and gender', () => {
    expect(allowProps({
      day_complete: true, freeze_used: false, overall_streak: 4, from: 'profile', referred: true,
      is_sandhya: true, is_sri_rudram: true, is_samidhadhanam: true, gender: 'male', practice: 'x',
    })).toEqual({ day_complete: true, freeze_used: false, overall_streak: 4, from: 'profile', referred: true })
  })
  it('handles missing props', () => {
    expect(allowProps()).toEqual({})
    expect(allowProps({ overall_streak: 0 })).toEqual({ overall_streak: 0 })
  })
  it('allow-list is exactly the agreed set', () => {
    expect(ALLOWED_PROPS).toEqual([
      'day_complete', 'freeze_used', 'overall_streak', 'from', 'referred',
      'install_utm_source', 'install_utm_medium', 'install_utm_campaign', 'install_utm_content', 'install_utm_term',
      'existing_user',
    ])
  })
})

describe('sanitizeUrl', () => {
  it('keeps utm_* and drops every other query param and the fragment', () => {
    expect(sanitizeUrl('https://app.nithyakarma.org/today?utm_source=ig&ref=ABC&code=x#access_token=t'))
      .toBe('https://app.nithyakarma.org/today?utm_source=ig')
  })
  it('masks referral codes in the path', () => {
    expect(sanitizeUrl('https://app.nithyakarma.org/r/AB12cd')).toBe('https://app.nithyakarma.org/r/:code')
    expect(sanitizeUrl('/r/AB12cd?utm_medium=wa')).toBe('/r/:code?utm_medium=wa')
  })
  it('leaves clean URLs and non-strings alone', () => {
    expect(sanitizeUrl('https://app.nithyakarma.org/history')).toBe('https://app.nithyakarma.org/history')
    expect(sanitizeUrl('$direct')).toBe('$direct')
    expect(sanitizeUrl(undefined)).toBeUndefined()
    expect(sanitizeUrl('')).toBe('')
  })
  it('handles relative paths with only non-utm params', () => {
    expect(sanitizeUrl('/today?ref=X')).toBe('/today')
  })
})

describe('sanitizeEvent', () => {
  it('cleans URL props in properties, $set and $set_once', () => {
    const e = sanitizeEvent({
      event: '$pageview',
      properties: { $current_url: 'https://a.org/r/X1?ref=X1', $referrer: 'https://b.org/?q=1', other: '?ref=keep' },
      $set: { $current_url: 'https://a.org/?token=z' },
      $set_once: { $initial_current_url: 'https://a.org/?utm_source=s&t=1', $initial_referrer: 'https://c.org/p?x=1' },
    })
    expect(e.properties).toEqual({ $current_url: 'https://a.org/r/:code', $referrer: 'https://b.org/', other: '?ref=keep' })
    expect(e.$set.$current_url).toBe('https://a.org/')
    expect(e.$set_once).toEqual({ $initial_current_url: 'https://a.org/?utm_source=s', $initial_referrer: 'https://c.org/p' })
  })
  it('passes null through', () => {
    expect(sanitizeEvent(null)).toBeNull()
    expect(sanitizeEvent({ event: 'x' })).toEqual({ event: 'x' })
  })
})

describe('initAnalytics', () => {
  it('initialises once in production with privacy-safe options', async () => {
    expect(initAnalytics()).toBe(true)
    expect(initAnalytics()).toBe(false)
    await _whenLoaded()
    expect(ph.init).toHaveBeenCalledTimes(1)
    const [key, opts] = ph.init.mock.calls[0]
    expect(key).toMatch(/^phc_/)
    expect(opts).toMatchObject({
      api_host: '/ingest', ui_host: 'https://eu.posthog.com', person_profiles: 'identified_only',
      autocapture: false, disable_session_recording: true, disable_surveys: true, capture_heatmaps: false,
      capture_dead_clicks: false, rageclick: false, capture_exceptions: false, advanced_disable_flags: true,
      disable_external_dependency_loading: true, disable_web_experiments: true, capture_pageleave: false,
    })
    const sent = opts.before_send({ event: '$pageview', properties: { $current_url: 'https://a.org/r/X?ref=1' } })
    expect(sent.properties).toEqual({ $current_url: 'https://a.org/r/:code', platform: 'web' })
  })
  it('stays off outside production builds', () => {
    vi.stubEnv('PROD', false)
    expect(initAnalytics()).toBe(false)
    expect(ph.init).not.toHaveBeenCalled()
  })
  it('talks to EU directly from the Android app', () => {
    native.value = true
    expect(apiHost()).toBe('https://eu.i.posthog.com')
    native.value = false
    expect(apiHost()).toBe('/ingest')
  })
})

describe('capture / identify / reset before and after init', () => {
  it('does nothing before init', () => {
    capture('x', { day_complete: true }); identifyUser({ id: 'u1' }); resetAnalytics(); registerOnce({ a: 1 })
    expect(ph.capture).not.toHaveBeenCalled()
    expect(ph.identify).not.toHaveBeenCalled()
    expect(ph.reset).not.toHaveBeenCalled()
    expect(ph.register_once).not.toHaveBeenCalled()
  })

  it('captures allow-listed props only', async () => {
    initAnalytics()
    await _whenLoaded()
    capture('practice_marked', { day_complete: true, is_sandhya: true, gender: 'f' })
    expect(ph.capture).toHaveBeenCalledWith('practice_marked', { day_complete: true })
  })

  it('identifies with is_internal and set_once props, never the email', async () => {
    initAnalytics()
    await _whenLoaded()
    identifyUser({ id: 'u1', email: 'e2e@nithyakarma.test' }, { install_utm_source: 'ig' })
    expect(ph.identify).toHaveBeenCalledWith('u1', { is_internal: true }, { install_utm_source: 'ig' })
    expect(JSON.stringify(ph.identify.mock.calls)).not.toContain('@')
    expect(ph.reset).not.toHaveBeenCalled()
  })

  it('resets first when the device is identified as a different account', async () => {
    initAnalytics()
    await _whenLoaded()
    ph._isIdentified.mockReturnValue(true)
    ph.get_distinct_id.mockReturnValue('someone-else')
    identifyUser({ id: 'u2', email: 'a@b.com' })
    expect(ph.reset).toHaveBeenCalledTimes(1)
    expect(ph.identify).toHaveBeenCalledWith('u2', { is_internal: false }, {})
  })

  it('does not reset when re-identifying the same account', async () => {
    initAnalytics()
    await _whenLoaded()
    ph._isIdentified.mockReturnValue(true)
    ph.get_distinct_id.mockReturnValue('u3')
    identifyUser({ id: 'u3' })
    expect(ph.reset).not.toHaveBeenCalled()
  })

  it('ignores identify without a user id; reset and register_once pass through', async () => {
    initAnalytics()
    await _whenLoaded()
    identifyUser(null); identifyUser({})
    expect(ph.identify).not.toHaveBeenCalled()
    resetAnalytics(); registerOnce({ install_utm_source: 'x' })
    expect(ph.reset).toHaveBeenCalledTimes(1)
    expect(ph.register_once).toHaveBeenCalledWith({ install_utm_source: 'x' })
  })
})

describe('withPlatform', () => {
  it('tags web and native events', () => {
    expect(withPlatform({ properties: { a: 1 } }).properties).toEqual({ a: 1, platform: 'web' })
    native.value = true
    expect(withPlatform({}).properties).toEqual({ platform: 'android' })
    expect(withPlatform(null)).toBeNull()
  })
})

describe('lazy loading', () => {
  it('queues calls made before the SDK has loaded and replays them in order', async () => {
    initAnalytics()
    capture('onboarding_complete', { referred: true, gender: 'male' })
    identifyUser({ id: 'u9', email: 'u9@x.com' })
    expect(ph.capture).not.toHaveBeenCalled()
    await _whenLoaded()
    expect(ph.capture).toHaveBeenCalledWith('onboarding_complete', { referred: true })
    expect(ph.identify).toHaveBeenCalledWith('u9', { is_internal: false }, {})
    expect(ph.capture.mock.invocationCallOrder[0]).toBeLessThan(ph.identify.mock.invocationCallOrder[0])
  })
})

describe('isInternalEmail', () => {
  it('flags only the test domain', () => {
    expect(isInternalEmail('e2e@nithyakarma.test')).toBe(true)
    expect(isInternalEmail('E2E@NITHYAKARMA.TEST')).toBe(true)
    expect(isInternalEmail('someone@nithyakarma.org')).toBe(false)
    expect(isInternalEmail('x@nithyakarma.test.com')).toBe(false)
    expect(isInternalEmail(null)).toBe(false)
  })
})
