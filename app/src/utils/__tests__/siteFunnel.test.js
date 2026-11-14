// Tests for the marketing site's cookieless funnel script (site/funnel.js).
import { describe, it, expect, vi, beforeEach } from 'vitest'

globalThis.window.__NK_FUNNEL_TEST__ = true
const { visitUtms, readUtms, withUtms, withPlayReferrer, cleanUrl, payload, run, KEY, uuidv7, visitIds } = await import('../../../../site/funnel.js')

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

describe('readUtms', () => {
  it('returns only real tags, no default', () => {
    expect(readUtms('')).toEqual({})
    expect(readUtms('?utm_source=ig&x=1')).toEqual({ utm_source: 'ig' })
  })
})

describe('uuidv7', () => {
  it('encodes the timestamp and the v7/variant bits', () => {
    const id = uuidv7(0x0190a1b2c3d4, n => new Uint8Array(n).fill(0xff))
    expect(id).toBe('0190a1b2-c3d4-7fff-bfff-ffffffffffff')
  })
})

describe('visitIds', () => {
  const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
  it('reuses ids within 30 idle minutes and starts a new visit after', () => {
    const s = store()
    const a = visitIds(s, 1_000_000)
    expect(visitIds(s, 1_000_000 + 29 * 60_000)).toEqual(a)
    const c = visitIds(s, 1_000_000 + 29 * 60_000 + 31 * 60_000)
    expect(c.session).not.toBe(a.session)
  })
  it('falls back to a per-page id when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    const ids = visitIds(blocked, 5)
    expect(ids.visitor).toBe(ids.session)
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

  const memStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
  const fakeWin = (search, sessionStorage = memStorage()) => ({
    location: { search, href: `https://nithyakarma.org/${search}`, pathname: '/', host: 'nithyakarma.org' }, sessionStorage,
  })

  it('sends one cookieless pageview through the /ingest proxy', () => {
    run(fakeWin('?utm_source=ig&ref=AB'), document)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/ingest/i/v0/e/')
    const body = JSON.parse(init.body)
    expect(body.event).toBe('$pageview')
    expect(body.properties.$current_url).toBe('https://nithyakarma.org/?utm_source=ig')
    expect(body.properties.utm_source).toBe('ig')
    expect(body.properties.$host).toBe('nithyakarma.org')
    expect(body.properties.$session_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(document.cookie).toBe('')
  })

  it('does not tag an untagged visit as utm_source=site (that default is only for outbound links)', () => {
    run(fakeWin(''), document)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties.utm_source).toBeUndefined()
  })

  it('keeps one visitor and session across pages of the same tab', () => {
    const storage = memStorage()
    run(fakeWin('', storage), document)
    run(fakeWin('', storage), document)
    const [a, b] = fetchMock.mock.calls.map(c => JSON.parse(c[1].body)).filter(x => x.event === '$pageview')
    expect(b.distinct_id).toBe(a.distinct_id)
    expect(b.properties.$session_id).toBe(a.properties.$session_id)
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

  it('still sends a pageview when even reading sessionStorage throws', () => {
    const win = fakeWin('')
    Object.defineProperty(win, 'sessionStorage', { get() { throw new Error('SecurityError') } })
    expect(() => run(win, document)).not.toThrow()
    expect(fetchMock).toHaveBeenCalled()
  })

  it('never throws when fetch is unavailable', () => {
    globalThis.fetch = () => { throw new Error('no fetch') }
    expect(() => run(fakeWin(''), document)).not.toThrow()
  })
})
