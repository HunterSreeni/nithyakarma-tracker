// Unit tests for scripts/play-upload.mjs (Play internal-track upload).
import { describe, it, expect, vi } from 'vitest'
import { releaseNotesFor, uploadToPlay, ALLOWED_TRACKS, PACKAGE_NAME } from '../play-upload.mjs'

const CHANGELOG = `# Changelog

## [1.3.0](https://github.com/x/y/compare/app-v1.2.3...app-v1.3.0) (2026-11-14)


### Features

* **analytics:** platform on every event ([26282b4](https://github.com/x/y/commit/26282b4451906e1c))
* **analytics:** PostHog EU funnel tracking ([673bfc5](https://github.com/x/y/commit/673bfc5ab))

### Bug Fixes

* fix the [streak card](https://x.org) layout ([abcdef1](https://github.com/x/y/commit/abcdef1))

## [1.2.3](https://github.com/x/y/compare/a...b) (2026-11-14)

* older entry ([1234567](https://github.com/x/y/commit/1234567))
`

describe('releaseNotesFor', () => {
  it('turns the version section into plain bullet notes', () => {
    expect(releaseNotesFor(CHANGELOG, '1.3.0')).toBe(
      '- analytics: platform on every event\n- analytics: PostHog EU funnel tracking\n- fix the streak card layout',
    )
  })
  it('does not bleed into the next version', () => {
    expect(releaseNotesFor(CHANGELOG, '1.2.3')).toBe('- older entry')
  })
  it('falls back when the version or bullets are missing', () => {
    expect(releaseNotesFor(CHANGELOG, '9.9.9')).toBe('Bug fixes and improvements.')
    expect(releaseNotesFor('## [2.0.0] (x)\n\n### Features\n', '2.0.0')).toBe('Bug fixes and improvements.')
    expect(releaseNotesFor('', '1.0.0')).toBe('Bug fixes and improvements.')
  })
  it('does not treat 1.3.0 as matching 1.3.01 or 11.3.0', () => {
    const log = '## [11.3.0] (x)\n* wrong\n## [1.3.0] (x)\n* right\n'
    expect(releaseNotesFor(log, '1.3.0')).toBe('- right')
  })
  it('keeps notes within Play\'s 500-character limit on whole bullets', () => {
    const many = '## [1.0.0] (x)\n' + Array.from({ length: 40 }, (_, i) => `* item number ${i} with some words`).join('\n')
    const notes = releaseNotesFor(many, '1.0.0')
    expect(notes.length).toBeLessThanOrEqual(500)
    expect(notes.endsWith('words')).toBe(true)
  })
  it('never splits an emoji when truncating', () => {
    const notes = releaseNotesFor(`## [1.0.0] (x)\n* ${'\u{1F64F}'.repeat(600)}`, '1.0.0')
    expect([...notes].length).toBe(500)
    expect(notes).not.toMatch(/[\uD800-\uDBFF]$/)
  })

  it('truncates a single oversized bullet', () => {
    const notes = releaseNotesFor(`## [1.0.0] (x)\n* ${'a'.repeat(700)}`, '1.0.0')
    expect(notes.length).toBe(500)
  })
})

function fakePublisher({ failAt } = {}) {
  const calls = []
  const step = (name, data) => vi.fn(async (args) => {
    calls.push([name, args])
    if (failAt === name) throw new Error(`${name} failed`)
    return { data }
  })
  return {
    calls,
    edits: {
      insert: step('insert', { id: 'edit-1' }),
      bundles: { upload: step('upload', { versionCode: 235911088 }) },
      tracks: { update: step('tracks', {}) },
      commit: step('commit', {}),
      delete: step('delete', {}),
    },
  }
}

const base = { aabPath: 'app-release.aab', track: 'internal', versionName: '1.3.0', releaseNotes: '- notes', openStream: () => 'STREAM' }

describe('uploadToPlay', () => {
  it('inserts, uploads, sets the internal track and commits, in that order', async () => {
    const publisher = fakePublisher()
    await expect(uploadToPlay({ publisher, ...base })).resolves.toEqual({ versionCode: '235911088', editId: 'edit-1' })
    expect(publisher.calls.map(c => c[0])).toEqual(['insert', 'upload', 'tracks', 'commit'])
    const [, upload] = publisher.calls[1]
    expect(upload).toEqual({ packageName: PACKAGE_NAME, editId: 'edit-1', media: { mimeType: 'application/octet-stream', body: 'STREAM' } })
    const [, tracks] = publisher.calls[2]
    expect(tracks).toEqual({
      packageName: PACKAGE_NAME, editId: 'edit-1', track: 'internal',
      requestBody: {
        track: 'internal',
        releases: [{
          name: '1.3.0 (235911088)', versionCodes: ['235911088'], status: 'completed',
          releaseNotes: [{ language: 'en-US', text: '- notes' }],
        }],
      },
    })
  })

  it.each(['upload', 'tracks', 'commit'])('deletes the edit and rethrows when %s fails', async (failAt) => {
    const publisher = fakePublisher({ failAt })
    await expect(uploadToPlay({ publisher, ...base })).rejects.toThrow(`${failAt} failed`)
    expect(publisher.calls.at(-1)[0]).toBe('delete')
    expect(publisher.calls.map(c => c[0])).not.toContain(failAt === 'commit' ? 'never' : 'commit')
  })

  it('refuses any track other than internal, before touching Play', async () => {
    expect(ALLOWED_TRACKS).toEqual(['internal'])
    for (const track of ['production', 'alpha', 'beta', '']) {
      const publisher = fakePublisher()
      await expect(uploadToPlay({ publisher, ...base, track })).rejects.toThrow('is not allowed')
      expect(publisher.calls).toEqual([])
    }
  })
})
