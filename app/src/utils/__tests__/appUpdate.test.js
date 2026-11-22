import { describe, it, expect, vi, beforeEach } from 'vitest'

const cap = vi.hoisted(() => ({ native: true, platform: 'ios' }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => cap.native, getPlatform: () => cap.platform },
}))
const info = vi.hoisted(() => ({ version: '1.5.0', fail: false }))
vi.mock('@capacitor/app', () => ({
  App: { getInfo: () => (info.fail ? Promise.reject(new Error('no plugin')) : Promise.resolve({ version: info.version })) },
}))
const db = vi.hoisted(() => ({ row: null, error: null, platformAsked: null, throws: false }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col, p) => {
          db.platformAsked = p
          return {
            maybeSingle: () => (db.throws ? Promise.reject(new Error('offline')) : Promise.resolve({ data: db.row, error: db.error })),
          }
        },
      }),
    }),
  },
}))

import { parseVersion, compareVersions, updateStatus, checkAppUpdate } from '../appUpdate'

const ROW = { suggested_version: '0.0.0', required_version: '0.0.0', store_url: 'https://apps.apple.com/app/id6837318179' }

beforeEach(() => {
  cap.native = true; cap.platform = 'ios'
  info.version = '1.5.0'; info.fail = false
  db.row = { ...ROW }; db.error = null; db.throws = false; db.platformAsked = null
})

describe('version helpers', () => {
  it('parses strict x.y.z only', () => {
    expect(parseVersion('1.10.1')).toEqual([1, 10, 1])
    expect(parseVersion(' 2.0.0 ')).toEqual([2, 0, 0])
    expect(parseVersion('1.10')).toBeNull()
    expect(parseVersion('1.10.1-beta')).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })

  it('compares numerically, not as text', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1)
    expect(compareVersions('1.10.1', '1.10.1')).toBe(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.0', '1.0.0')).toBeNull()
  })

  it('required wins over suggested; malformed or missing config never prompts', () => {
    expect(updateStatus('1.5.0', { suggested_version: '1.10.1', required_version: '1.6.0' })).toBe('required')
    expect(updateStatus('1.5.0', { suggested_version: '1.10.1', required_version: '0.0.0' })).toBe('suggested')
    expect(updateStatus('1.10.1', { suggested_version: '1.10.1', required_version: '1.10.1' })).toBe('ok')
    expect(updateStatus('1.5.0', { suggested_version: 'soon', required_version: 'x' })).toBe('ok')
    expect(updateStatus('1.5.0', null)).toBe('ok')
  })
})

describe('checkAppUpdate', () => {
  it('asks for this platform and returns a suggested update with the store link', async () => {
    db.row = { ...ROW, suggested_version: '1.10.1' }
    await expect(checkAppUpdate()).resolves.toEqual({
      status: 'suggested', installed: '1.5.0', target: '1.10.1',
      storeUrl: ROW.store_url, storeName: 'the App Store',
    })
    expect(db.platformAsked).toBe('ios')
  })

  it('returns required with Google Play on Android', async () => {
    cap.platform = 'android'
    db.row = { ...ROW, required_version: '1.6.0', store_url: 'https://play.google.com/x' }
    const r = await checkAppUpdate()
    expect(r).toMatchObject({ status: 'required', target: '1.6.0', storeName: 'Google Play' })
    expect(db.platformAsked).toBe('android')
  })

  it('never checks on the web', async () => {
    cap.native = false; cap.platform = 'web'
    db.row = { ...ROW, required_version: '9.0.0' }
    await expect(checkAppUpdate()).resolves.toEqual({ status: 'ok' })
    expect(db.platformAsked).toBeNull()
  })

  it.each([
    ['a query error', () => { db.error = { message: 'boom' } }],
    ['a thrown network error', () => { db.throws = true }],
    ['no row', () => { db.row = null }],
    ['no version from the app', () => { info.fail = true }],
  ])('fails open on %s', async (_label, arrange) => {
    db.row = { ...ROW, required_version: '9.0.0' }
    arrange()
    await expect(checkAppUpdate()).resolves.toEqual({ status: 'ok' })
  })
})
