// Tests for the marketing site's cookieless funnel script (site/funnel.js).
import { describe, it, expect, vi, beforeEach } from 'vitest'

globalThis.window.__NK_FUNNEL_TEST__ = true
const { visitUtms, withUtms, withPlayReferrer, cleanUrl, payload, run, KEY } = await import('../../../../site/funnel.js')

const PLAY = 'https://play.google.com/store/apps/details?id=org.nithyakarma.app'

describe('visitUtms', () => {
  it('reads utm_* from the visit and ignores other params', () => {
    expect(visitUtms('?utm_source=ig&utm_campaign=ekadashi&fbclid=1'))
      .toEqual({ utm_source: 'ig', utm_campaign: 'ekadashi' })
  })
  it('defaults to utm_source=site, utm_medium=website when untagged', () => {
    expect(visitUtms('')).toEqual({ utm_source: 'site', utm_medium: 'website' })
    expect(visitUtms('?utm_medium=qr')).toEqual({ utm_source: 'site', utm_medium: 'qr' })
  })
})

describe('withUtms', () => {
  it('adds UTMs, keeps existing params and fragment, never overwrites', () => {
    expect(withUtms('https://app.nithyakarma.org/?ref=AB#x', { utm_source: 'ig', utm_medium: 'social' }))
      .toBe('https://app.nithyakarma.org/?ref=AB&utm_source=ig&utm_medium=social#x')
    expect(withUtms('https://app.nithyakarma.org/?utm_source=keep', { utm_source: 'ig' }))
      .toBe('https://app.nithyakarma.org/?utm_source=keep')
  })
})

describe('withPlayReferrer', () => {
  it('puts the UTMs in one referrer param, encoded exactly once', () => {
    const out = withPlayReferrer(PLAY, { utm_source: 'site', utm_medium: 'website' })
    expect(out).toBe(`${PLAY}&referrer=utm_source%3Dsite%26utm_medium%3Dwebsite`)
    expect(new URL(out).searchParams.get('referrer')).toBe('utm_source=site&utm_medium=website')
  })
  it('leaves a link that already has a referrer alone', () => {
    const tagged = `${PLAY}&referrer=utm_source%3Dx`
    expect(withPlayReferrer(tagged, { utm_source: 'y' })).toBe(tagged)
  })
})

describe('cleanUrl', () => {
  it('keeps only utm_* and drops the fragment', () => {
    expect(cleanUrl('https://nithyakarma.org/karma.html?utm_source=ig&ref=AB#top'))
      .toBe('https://nithyakarma.org/karma.html?utm_source=ig')
    expect(cleanUrl('https://nithyakarma.org/?x=1')).toBe('https://nithyakarma.org/')
  })
})

describe('payload', () => {
  it('never creates person profiles and carries the public key', () => {
    expect(payload('$pageview', { a: 1 }, 'id-1')).toEqual({
      api_key: KEY, event: '$pageview', distinct_id: 'id-1',
      properties: { a: 1, $process_person_profile: false, $lib: 'nithyakarma-site' },
    })
  })
})

describe('run', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock
    document.body.innerHTML = `
      <a id="app" href="https://app.nithyakarma.org">Open</a>
      <a id="play" href="${PLAY}">Play</a>
      <a id="other" href="/privacy.html">Privacy</a>`
  })

  const fakeWin = (search) => ({ location: { search, href: `https://nithyakarma.org/${search}`, pathname: '/' } })

  it('sends one cookieless pageview through the /ingest proxy', () => {
    run(fakeWin('?utm_source=ig&ref=AB'), document)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/ingest/i/v0/e/')
    const body = JSON.parse(init.body)
    expect(body.event).toBe('$pageview')
    expect(body.properties.$current_url).toBe('https://nithyakarma.org/?utm_source=ig')
    expect(body.properties.utm_source).toBe('ig')
    expect(document.cookie).toBe('')
  })

  it('rewrites CTA links and tracks their clicks, leaving other links alone', () => {
    run(fakeWin(''), document)
    expect(document.getElementById('app').href).toBe('https://app.nithyakarma.org/?utm_source=site&utm_medium=website')
    expect(document.getElementById('play').href).toBe(`${PLAY}&referrer=utm_source%3Dsite%26utm_medium%3Dwebsite`)
    expect(document.getElementById('other').getAttribute('href')).toBe('/privacy.html')
    document.getElementById('play').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    const click = JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
    expect(click.event).toBe('cta_clicked')
    expect(click.properties.target).toBe('playstore')
  })

  it('never throws when fetch is unavailable', () => {
    globalThis.fetch = () => { throw new Error('no fetch') }
    expect(() => run(fakeWin(''), document)).not.toThrow()
  })
})
